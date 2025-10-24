// Global classifier runner that continues in the background across routes.
// Responsibilities:
// - After login, classify first 15 emails immediately
// - Then keep classifying in background in batches of 10 up to target (default 100)
// - Persist results into localStorage appCache.classifiedEmailsMap
// - Provide subscription API so pages (Dashboard) can show progress/badges

import { fetchAndClassify } from '../services/api';

const state = {
	running: false,
	initialBusy: false,
	initialProgress: { done: 0, total: 0, etaMs: 0 },
	bgBusy: false,
	sessionAdded: 0,
	target: 100,
	batchSize: 10,
	startedAt: null,
};

const subscribers = new Set();
function notify() {
	const snapshot = { ...state };
	subscribers.forEach((cb) => {
		try { cb(snapshot); } catch (_) {}
	});
}

function readCacheRoot() {
	try {
		const raw = localStorage.getItem('appCache');
		if (!raw) return null;
		const obj = JSON.parse(raw);
		if (obj && typeof obj === 'object') return obj;
	} catch {}
	return null;
}

function writeCacheRoot(root) {
	try {
		const safe = root && typeof root === 'object' ? root : { classifiedEmailsMap: {} };
		localStorage.setItem('appCache', JSON.stringify(safe));
	} catch {}
}

async function applyProcessed(processed, perItemDelay = 20, onProgress = null) {
	if (!Array.isArray(processed) || processed.length === 0) return 0;
	let root = readCacheRoot() || { classifiedEmailsMap: {} };
	let mapObj = (root && root.classifiedEmailsMap) || {};
	if (!mapObj || typeof mapObj !== 'object') mapObj = {};

	let added = 0;
	let done = 0;
	const total = processed.length;
	let avgMs = 60;
	for (const item of processed) {
		const st = Date.now();
		if (item && item.id) {
			const prev = mapObj[item.id] || {};
			const receivedAt = prev.receivedAt
				|| item.receivedAt
				|| item.timestamp
				|| item.internalDate
				|| item.date
				|| Date.now();
			const existed = !!mapObj[item.id];
			mapObj[item.id] = { ...prev, ...item, receivedAt };
			if (!existed) added += 1;
		}
		root = { classifiedEmailsMap: mapObj };
		writeCacheRoot(root);
		localStorage.setItem('classifiedEmailsMap', JSON.stringify(mapObj));

		done += 1;
		if (typeof onProgress === 'function') {
			const stepMs = Date.now() - st;
			avgMs = Math.round((avgMs * (done - 1) + stepMs) / done);
			const remaining = total - done;
			onProgress(done, total, remaining * Math.max(avgMs, 40));
		}
		// eslint-disable-next-line no-await-in-loop
		if (perItemDelay > 0) await new Promise((r) => setTimeout(r, perItemDelay));
	}
	return added;
}

async function runInitial() {
	state.initialBusy = true;
	state.initialProgress = { done: 0, total: 0, etaMs: 0 };
	notify();
	const resp = await fetchAndClassify({ max_results: 15 });
	const processed = Array.isArray(resp?.processed) ? resp.processed : [];
	const total = processed.length || (resp?.new_count ?? 0);
	state.initialProgress = { done: 0, total, etaMs: total * 100 };
	notify();
	const added = await applyProcessed(
		processed,
		30,
		(done, totalNow, eta) => {
			state.initialProgress = { done, total: totalNow, etaMs: eta };
			notify();
		}
	);
	state.sessionAdded += added;
	state.initialBusy = false;
	notify();
}

async function runBackground() {
	state.bgBusy = true;
	notify();
	try {
		while (state.sessionAdded < state.target) {
			const remaining = Math.max(1, state.target - state.sessionAdded);
			const batch = Math.min(remaining, state.batchSize);
			const resp = await fetchAndClassify({ max_results: batch });
			const processed = Array.isArray(resp?.processed) ? resp.processed : [];
			const added = await applyProcessed(processed, 25, null);
			state.sessionAdded += added;
			notify();
			if (!added) break; // nothing new
			// eslint-disable-next-line no-await-in-loop
			await new Promise((r) => setTimeout(r, 150));
		}
	} catch (e) {
		// keep quiet; background failures should not interrupt user
		// console.warn('Background classifier error', e);
	} finally {
		state.bgBusy = false;
		state.running = false;
		notify();
	}
}

async function startIfNeeded() {
	// Ensure we have a token
	const token = localStorage.getItem('gmailToken');
	if (!token) return;
	if (state.running || state.initialBusy || state.bgBusy) return;
	state.running = true;
	state.startedAt = Date.now();
	state.sessionAdded = 0;
	notify();
	try {
		await runInitial();
	} catch (e) {
		state.running = false;
		state.initialBusy = false;
		notify();
		return;
	}
	await runBackground();
}

function subscribe(cb) {
	if (typeof cb === 'function') {
		subscribers.add(cb);
		// emit current state immediately
		try { cb({ ...state }); } catch (_) {}
		return () => subscribers.delete(cb);
	}
	return () => {};
}

function getState() {
	return { ...state };
}

const runner = {
	startIfNeeded,
	subscribe,
	getState,
	setTarget(n) { state.target = Math.max(1, Number(n) || 100); notify(); },
	setBatchSize(n) { state.batchSize = Math.max(1, Number(n) || 10); notify(); },
};

export default runner;

