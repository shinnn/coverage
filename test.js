'use strict';

const {execFile} = require('child_process');
const {join} = require('path');
const {promisify} = require('util');

const attempt = require('lodash/attempt');
const test = require('tape');

const coverage = require.resolve('.');
const execNode = promisify(execFile).bind(null, process.argv[0]);
const timeout = 1000000;

test('A `coverage` command with a command', async t => {
	const {stderr, stdout} = await execNode([coverage, 'node', '-e', 'console.error("Hi")'], {timeout});

	t.ok(
		stdout.includes('All files'),
		'should print a coverage report.'
	);

	t.ok(
		stderr.startsWith('Hi'),
		'should print output of the original command.'
	);

	const result = attempt(require.resolve, join(__dirname, 'coverage', 'index.html'));

	if (/^1|true$/ui.test(process.env.CI) || !!process.env.GITHUB_ACTION) {
		t.equal(
			result.code,
			'MODULE_NOT_FOUND',
			'should write no HTML reports to ./coverage.'
		);
	} else {
		t.equal(
			typeof result,
			'string',
			'should write HTML reports to ./coverage.'
		);
	}

	t.end();
});

test('A `coverage` command with a file path', async t => {
	const {stdout} = await execNode([coverage, require.resolve('./package.json')], {timeout});

	t.ok(
		stdout.includes('All files'),
		'should print a coverage report.'
	);

	t.end();
});

test('A `coverage` command with nyc flags', async t => {
	try {
		await execNode([coverage, '--reporter=unknown', 'node', '--version'], {timeout});
		t.fail('Unexpectedly succeeded.');
	} catch ({stderr}) {
		t.ok(
			stderr.includes('Cannot find module \'unknown\''),
			'should pass flags to the underlying `nyc` command.'
		);
	}

	t.end();
});

test('A `coverage` command with a non-executable path', async t => {
	try {
		await execNode([coverage, require.resolve('./.gitattributes')], {timeout});
		t.fail('Unexpectedly succeeded.');
	} catch ({code, stderr, stdout}) {
		t.ok(
			stderr.includes('SyntaxError'),
			'should write error messages to the stderr.'
		);

		t.ok(
			stdout.includes('All files'),
			'should print a coverage report.'
		);

		t.equal(
			code,
			1,
			'should reflect exit code of the spawned process.'
		);
	}

	t.end();
});

test('A `coverage` command with a non-existing command', async t => {
	try {
		await execNode([coverage, 'this-command-does-not-exist'], {timeout});
		t.fail('Unexpectedly succeeded.');
	} catch ({code, stderr, stdout}) {
		t.equal(
			stderr,
			`Both a command \`this-command-does-not-exist\` and a Node.js entry point ${
				join(__dirname, 'this-command-does-not-exist')
			} don't exist.\n`,
			'should write an error message to the stderr.'
		);

		t.equal(
			stdout,
			'',
			'should write nothing to the stdout.'
		);

		t.equal(
			code,
			127,
			'should exit with code 127.'
		);
	}

	t.end();
});

test('A `coverage` command with no arguments', async t => {
	try {
		await execNode([coverage], {timeout});
		t.fail('Unexpectedly succeeded.');
	} catch ({code, stderr, stdout}) {
		t.ok(
			stderr.includes('check whether coverage is within thresholds provided'),
			'should write help to the stderr.'
		);

		t.equal(
			stdout,
			'',
			'should write nothing to the stderr.'
		);

		t.equal(
			code,
			1,
			'should exit with code 1.'
		);
	}

	t.end();
});

test('A `coverage report` command', async t => {
	const {stdout} = await execNode([coverage, 'report', '--reporter=text-summary'], {timeout});

	t.ok(
		stdout.includes('Coverage summary'),
		'should report coverage.'
	);

	t.end();
});
