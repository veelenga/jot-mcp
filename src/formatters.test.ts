import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatJotEntry,
  formatJotList,
  formatContextEntry,
  formatContextList,
  formatSearchCriteria,
} from './formatters.js';
import { JotEntry, Context } from './types.js';

describe('Formatters', () => {
  describe('formatJotEntry', () => {
    it('should format a basic jot entry', () => {
      const jot: JotEntry = {
        id: '1',
        contextId: 'ctx1',
        message: 'Test message',
        createdAt: new Date('2025-10-27T12:00:00').getTime(),
        expiresAt: Date.now() + 1000000,
        tags: [],
        metadata: {},
      };

      const formatted = formatJotEntry(jot, 0, false);

      assert.ok(formatted.includes('1. Test message'));
      assert.ok(formatted.includes('Created:'));
    });

    it('should format jot with tags', () => {
      const jot: JotEntry = {
        id: '1',
        contextId: 'ctx1',
        message: 'Test message',
        createdAt: Date.now(),
        expiresAt: null,
        tags: ['bug', 'urgent'],
        metadata: {},
      };

      const formatted = formatJotEntry(jot, 0, false);

      assert.ok(formatted.includes('Tags: bug, urgent'));
    });

    it('should format permanent jot', () => {
      const jot: JotEntry = {
        id: '1',
        contextId: 'ctx1',
        message: 'Permanent note',
        createdAt: Date.now(),
        expiresAt: null,
        tags: [],
        metadata: {},
      };

      const formatted = formatJotEntry(jot, 0, false);

      assert.ok(formatted.includes('Permanent'));
    });

    it('should show context when requested', () => {
      const jot: JotEntry = {
        id: '1',
        contextId: 'ctx1',
        message: 'Test',
        createdAt: Date.now(),
        expiresAt: null,
        tags: [],
        metadata: {},
      };

      const formatted = formatJotEntry(jot, 0, true, 'my-context');

      assert.ok(formatted.includes('my-context'));
    });
  });

  describe('formatJotList', () => {
    it('should format empty list', () => {
      const formatted = formatJotList([], '📍 Current Context: test', false, () => undefined);

      assert.ok(formatted.includes('No jots found'));
    });

    it('should format list with jots', () => {
      const jots: JotEntry[] = [
        {
          id: '1',
          contextId: 'ctx1',
          message: 'Message 1',
          createdAt: Date.now(),
          expiresAt: null,
          tags: [],
          metadata: {},
        },
        {
          id: '2',
          contextId: 'ctx1',
          message: 'Message 2',
          createdAt: Date.now(),
          expiresAt: null,
          tags: [],
          metadata: {},
        },
      ];

      const formatted = formatJotList(jots, '📍 Current Context: test', false, () => 'test');

      assert.ok(formatted.includes('Message 1'));
      assert.ok(formatted.includes('Message 2'));
      assert.ok(formatted.includes('2 jots'));
    });

    it('should use singular for single jot', () => {
      const jots: JotEntry[] = [
        {
          id: '1',
          contextId: 'ctx1',
          message: 'Message 1',
          createdAt: Date.now(),
          expiresAt: null,
          tags: [],
          metadata: {},
        },
      ];

      const formatted = formatJotList(jots, '📍 Current Context: test', false, () => 'test');

      assert.ok(formatted.includes('1 jot in'));
      assert.ok(!formatted.includes('1 jots'));
    });
  });

  describe('formatContextEntry', () => {
    it('should format context entry', () => {
      const context: Context = {
        id: '1',
        name: 'my-context',
        repository: 'my-repo',
        branch: 'main',
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
        jotCount: 5,
      };

      const formatted = formatContextEntry(context, 0, false);

      assert.ok(formatted.includes('my-context'));
      assert.ok(formatted.includes('my-repo'));
      assert.ok(formatted.includes('main'));
      assert.ok(formatted.includes('5 jots'));
    });

    it('should mark current context', () => {
      const context: Context = {
        id: '1',
        name: 'my-context',
        repository: null,
        branch: null,
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
        jotCount: 0,
      };

      const formatted = formatContextEntry(context, 0, true);

      assert.ok(formatted.includes('(current)'));
    });

    it('should use singular for single jot', () => {
      const context: Context = {
        id: '1',
        name: 'my-context',
        repository: null,
        branch: null,
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
        jotCount: 1,
      };

      const formatted = formatContextEntry(context, 0, false);

      assert.ok(formatted.includes('1 jot'));
      assert.ok(!formatted.includes('1 jots'));
    });
  });

  describe('formatContextList', () => {
    it('should format empty context list', () => {
      const formatted = formatContextList([], '');

      assert.ok(formatted.includes('No contexts found'));
    });

    it('should format context list', () => {
      const contexts: Context[] = [
        {
          id: '1',
          name: 'context1',
          repository: null,
          branch: null,
          createdAt: Date.now(),
          lastModifiedAt: Date.now(),
          jotCount: 5,
        },
        {
          id: '2',
          name: 'context2',
          repository: null,
          branch: null,
          createdAt: Date.now(),
          lastModifiedAt: Date.now(),
          jotCount: 3,
        },
      ];

      const formatted = formatContextList(contexts, 'context1');

      assert.ok(formatted.includes('context1'));
      assert.ok(formatted.includes('context2'));
      assert.ok(formatted.includes('2 contexts'));
      assert.ok(formatted.includes('8 total jots'));
    });
  });

  describe('formatSearchCriteria', () => {
    it('should format empty criteria', () => {
      const formatted = formatSearchCriteria({});

      assert.strictEqual(formatted, '');
    });

    it('should format query criteria', () => {
      const formatted = formatSearchCriteria({ query: 'test' });

      assert.ok(formatted.includes('query: "test"'));
    });

    it('should format tags criteria', () => {
      const formatted = formatSearchCriteria({ tags: ['bug', 'urgent'] });

      assert.ok(formatted.includes('tags: bug, urgent'));
    });

    it('should format date criteria', () => {
      const from = new Date('2025-10-01').getTime();
      const to = new Date('2025-10-31').getTime();

      const formatted = formatSearchCriteria({ fromDate: from, toDate: to });

      assert.ok(formatted.includes('from:'));
      assert.ok(formatted.includes('to:'));
    });

    it('should format multiple criteria', () => {
      const formatted = formatSearchCriteria({
        query: 'test',
        tags: ['bug'],
        fromDate: Date.now(),
      });

      assert.ok(formatted.includes('query:'));
      assert.ok(formatted.includes('tags:'));
      assert.ok(formatted.includes('from:'));
    });
  });
});
