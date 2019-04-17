#!/usr/bin/env node
'use strict';

const assert = require('assert').strict;
const {dirname, join, resolve: resolvePath} = require('path');
const {promisify} = require('util');
const {spawn} = require('child_process');

const foregroundChild = require('foreground-child');
const normalizePackageData = require('normalize-package-data');
const slash = require('slash');
const which = require('which');
const yargsParser = require('yargs-parser');

const cwd = process.cwd();
const c8PackageJsonPath = require.resolve('c8/package.json');
const c8PackageData = require(c8PackageJsonPath);

normalizePackageData(c8PackageData);

const c8BinPath = join(dirname(c8PackageJsonPath), c8PackageData.bin.c8);
const [nodePath] = process.argv;
const optionArgs = process.argv.slice(2);
const {_: [command], reporter} = yargsParser(optionArgs);
const promisifiedWhich = promisify(which);
const timeout = 2 ** 32 / 2 - 1;
const willUploadLcov = /^1|true$/ui.test(process.env.CI) || !!process.env.GITHUB_ACTION;

(async () => {
	if (command === undefined) {
		require(c8BinPath);
		return;
	}

	if (command === 'report') {
		foregroundChild(nodePath, [c8BinPath, ...optionArgs]);
		return;
	}

	const prepareArgs = (async () => {
		try {
			await promisifiedWhich(command);
		} catch {
			let entryPath = resolvePath(cwd, command);

			try {
				entryPath = require.resolve(entryPath);
			} catch {
				console.error(`Both a command \`${command}\` and a Node.js entry point ${entryPath} don't exist.`);
				process.exit(127);
			}

			optionArgs.splice(optionArgs.indexOf(command), 1, nodePath, entryPath);
		}

		return [
			nodePath,
			[
				c8BinPath,
				...reporter === undefined ? [
					'--reporter=text',
					`--reporter=${willUploadLcov ? 'lcovonly' : 'html'}`
				] : [],
				...optionArgs
			]
		];
	})();

	if (!willUploadLcov) {
		foregroundChild(...await prepareArgs);
		return;
	}

	const [code, codecovBash] = await Promise.all([
		(async () => {
			/*
			On Node.js >= 11.3.0, const {once} = require('events') is available
			https://nodejs.org/api/events.html#events_events_once_emitter_name

			return (await once(spawn(...await prepareArgs, {
				cwd,
				stdio: 'inherit',
				timeout
			}), 'exit'))[0];
			*/

			const args = await prepareArgs;

			return new Promise((resolve, reject) => {
				spawn(...args, {
					cwd,
					stdio: 'inherit',
					timeout
				})
				.once('error', reject)
				.once('exit', resolve);
			});
		})(),
		(async () => {
			try {
				assert(
					process.env.APPVEYOR !== 'true' && process.env.APPVEYOR !== 'True',
					'Using codecov-node instead of codecov-bash to avoid Windows ENAMETOOLONG error.'
				);
				await Promise.all([promisifiedWhich('bash'), promisifiedWhich('git')]);
			} catch {
				/*
				On Node.js >= 11.3.0, const {once} = require('events') is available
				https://nodejs.org/api/events.html#events_events_once_emitter_name

				await once(spawn('npm', [
					'install',
					'--no-package-lock',
					'--no-save',
					'codecov@3'
				], {
					cwd,
					shell: process.platform === 'win32',
					timeout
				}), 'exit');
				*/

				return new Promise(resolve => spawn('npm', [
					'install',
					'--no-audit',
					'--no-package-lock',
					'--no-save',
					'codecov@3'
				], {
					cwd,
					shell: process.platform === 'win32',
					timeout
				}).once('exit', () => resolve('')));
			}

			const {connect} = require('http2');
			const {pipeline, Writable} = require('stream');

			const client = connect('https://codecov.io');
			const request = client.request({':path': '/bash'});
			let body = '';

			request.setEncoding('utf8');
			request.end();

			await promisify(pipeline)(request, new Writable({
				write(chunk, _, cb) {
					body += chunk;
					cb();
				}
			}));

			return body;
		})()
	]);

	if (code !== 0) {
		process.exit(code);
	}

	const isTravisCi = process.env.TRAVIS === 'true';

	if (isTravisCi) {
		console.log('travis_fold:start:codecov\nupload coverage to codecov.io');
	}

	const reportArgs = codecovBash ? [
		'bash',
		[
			'-c',
			codecovBash,
			'--',
			'-X',
			'gcov',
			'-X',
			'coveragepy',
			'-X',
			'gcovout',
			'-f',
			slash(join(cwd, 'coverage', 'lcov.info'))
		]
	] : [
		'npx',
		[
			'codecov',
			'--disable=gcov,search',
			`--file=${join(cwd, 'coverage', 'lcov.info')}`
		]
	];

	if (process.env.GITHUB_ACTION) {
		const branch = (process.env.GITHUB_REF || '').replace(/^refs\/heads\//u, '');

		if (codecovBash) {
			reportArgs[1].push(
				'-r',
				process.env.GITHUB_REPOSITORY,
				'-B',
				branch,
				'-C',
				process.env.GITHUB_SHA
			);
		} else {
			reportArgs[1].push(
				'--disable=detect,gcov,search',
				`--slug=${process.env.GITHUB_REPOSITORY}`,
				`--branch=${branch}`,
				`--commit=${process.env.GITHUB_SHA}`
			);
		}
	}

	foregroundChild(...reportArgs, ...isTravisCi ? [
		done => {
			console.log('travis_fold:end:codecov');
			done();
		}
	] : []);
})();
