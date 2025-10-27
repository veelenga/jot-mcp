import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initializeDatabase } from '../src/database.js';
import { JotRepository } from '../src/repository.js';
import { JotService } from '../src/service.js';

describe('JotService', () => {
  let testDir: string;
  let dbPath: string;
  let service: JotService;

  before(() => {
    testDir = mkdtempSync(join(tmpdir(), 'jot-test-'));
    dbPath = join(testDir, 'test.db');
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    const db = initializeDatabase(dbPath);
    // Clear all tables
    db.exec('DELETE FROM metadata');
    db.exec('DELETE FROM tags');
    db.exec('DELETE FROM jots');
    db.exec('DELETE FROM contexts');
    const repository = new JotRepository(db);
    service = new JotService(repository);
  });

  describe('Jot Creation', () => {
    it('should create jot with auto-detected context', () => {
      const jot = service.createJot({ message: 'test message' });

      assert.ok(jot.id);
      assert.strictEqual(jot.message, 'test message');
      assert.ok(jot.contextId);
    });

    it('should create jot with explicit context', () => {
      const jot = service.createJot({ message: 'test message', contextName: 'my-context' });

      const context = service.getContext(jot.contextId);
      assert.strictEqual(context?.name, 'my-context');
    });

    it('should create jot with default TTL', () => {
      const jot = service.createJot({ message: 'test message' });

      assert.ok(jot.expiresAt);
      assert.ok(jot.expiresAt > Date.now());
    });

    it('should create permanent jot with ttlDays=0', () => {
      const jot = service.createJot({ message: 'important', ttlDays: 0 });

      assert.strictEqual(jot.expiresAt, null);
    });

    it('should create jot with custom TTL', () => {
      const jot = service.createJot({ message: 'test', ttlDays: 7 });

      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const expectedExpiry = Date.now() + sevenDays;

      assert.ok(jot.expiresAt);
      // Allow 1 second tolerance for test execution time
      assert.ok(Math.abs(jot.expiresAt - expectedExpiry) < 1000);
    });

    it('should create jot with tags', () => {
      const jot = service.createJot({ message: 'test', tags: ['bug', 'urgent'] });

      assert.strictEqual(jot.tags.length, 2);
      assert.ok(jot.tags.includes('bug'));
      assert.ok(jot.tags.includes('urgent'));
    });

    it('should create jot with metadata', () => {
      const jot = service.createJot({
        message: 'test',
        metadata: { url: 'https://example.com', priority: 'high' },
      });

      assert.strictEqual(jot.metadata.url, 'https://example.com');
      assert.strictEqual(jot.metadata.priority, 'high');
    });
  });

  describe('Context Management', () => {
    it('should list contexts', () => {
      service.createJot({ message: 'msg1', contextName: 'context1' });
      service.createJot({ message: 'msg2', contextName: 'context2' });

      const contexts = service.listContexts();

      assert.strictEqual(contexts.length, 2);
    });

    it('should get context by id', () => {
      const jot = service.createJot({ message: 'test', contextName: 'my-context' });
      const context = service.getContext(jot.contextId);

      assert.ok(context);
      assert.strictEqual(context!.name, 'my-context');
    });

    it('should delete context', () => {
      const jot = service.createJot({ message: 'test', contextName: 'my-context' });

      const deleted = service.deleteContext(jot.contextId);

      assert.ok(deleted);
      assert.strictEqual(service.getContext(jot.contextId), null);
    });

    it('should delete context by name', () => {
      service.createJot({ message: 'test', contextName: 'my-context' });

      const deleted = service.deleteContext('my-context');

      assert.ok(deleted);
    });
  });

  describe('Jot Retrieval', () => {
    it('should get context jots', () => {
      service.createJot({ message: 'msg1', contextName: 'context1' });
      service.createJot({ message: 'msg2', contextName: 'context1' });
      service.createJot({ message: 'msg3', contextName: 'context2' });

      const jots = service.getContextJots('context1');

      assert.strictEqual(jots.length, 2);
    });

    it('should limit context jots', () => {
      service.createJot({ message: 'msg1', contextName: 'context1' });
      service.createJot({ message: 'msg2', contextName: 'context1' });
      service.createJot({ message: 'msg3', contextName: 'context1' });

      const jots = service.getContextJots('context1', 2);

      assert.strictEqual(jots.length, 2);
    });

    it('should search jots', () => {
      service.createJot({ message: 'authentication bug', contextName: 'backend' });
      service.createJot({ message: 'payment feature', contextName: 'backend' });

      const results = service.searchJots({ query: 'authentication' });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].message, 'authentication bug');
    });

    it('should search with context filter', () => {
      const jot1 = service.createJot({ message: 'msg1', contextName: 'context1' });
      service.createJot({ message: 'msg2', contextName: 'context2' });

      const results = service.searchJots({ contextId: jot1.contextId });

      assert.strictEqual(results.length, 1);
    });
  });

  describe('Jot Update', () => {
    it('should update jot message', () => {
      const jot = service.createJot({ message: 'original message' });

      const updated = service.updateJot(jot.id, { message: 'updated message' });

      assert.ok(updated);
      assert.strictEqual(updated!.message, 'updated message');
      assert.strictEqual(updated!.id, jot.id);
    });

    it('should update jot TTL', () => {
      const jot = service.createJot({ message: 'test', ttlDays: 14 });

      const updated = service.updateJot(jot.id, { ttlDays: 0 }); // Make permanent

      assert.ok(updated);
      assert.strictEqual(updated!.expiresAt, null);
    });

    it('should update jot tags', () => {
      const jot = service.createJot({ message: 'test', tags: ['old-tag'] });

      const updated = service.updateJot(jot.id, { tags: ['new-tag1', 'new-tag2'] });

      assert.ok(updated);
      assert.strictEqual(updated!.tags.length, 2);
      assert.ok(updated!.tags.includes('new-tag1'));
      assert.ok(updated!.tags.includes('new-tag2'));
    });

    it('should update jot metadata', () => {
      const jot = service.createJot({ message: 'test', metadata: { old: 'value' } });

      const updated = service.updateJot(jot.id, { metadata: { new: 'metadata' } });

      assert.ok(updated);
      assert.strictEqual(updated!.metadata.new, 'metadata');
      assert.strictEqual(updated!.metadata.old, undefined);
    });

    it('should update multiple fields at once', () => {
      const jot = service.createJot({ message: 'original', ttlDays: 14, tags: ['tag1'] });

      const updated = service.updateJot(jot.id, {
        message: 'updated',
        ttlDays: 0,
        tags: ['new-tag'],
        metadata: { key: 'value' },
      });

      assert.ok(updated);
      assert.strictEqual(updated!.message, 'updated');
      assert.strictEqual(updated!.expiresAt, null);
      assert.strictEqual(updated!.tags.length, 1);
      assert.ok(updated!.tags.includes('new-tag'));
      assert.strictEqual(updated!.metadata.key, 'value');
    });

    it('should return null when updating non-existent jot', () => {
      const updated = service.updateJot(999, { message: 'test' });

      assert.strictEqual(updated, null);
    });
  });

  describe('Jot Deletion', () => {
    it('should delete jot by id', () => {
      const jot = service.createJot({ message: 'test' });

      const deleted = service.deleteJot(jot.id);

      assert.ok(deleted);
    });

    it('should cleanup expired jots', () => {
      service.createJot({ message: 'expired', ttlDays: -1 }); // Expired
      service.createJot({ message: 'active', ttlDays: 7 }); // Active

      const deleted = service.cleanupExpired();

      assert.strictEqual(deleted, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context name', () => {
      const jot = service.createJot({ message: 'test', contextName: '' });

      // Should fall back to auto-detection
      assert.ok(jot.contextId);
    });

    it('should handle special characters in messages', () => {
      const message = "test with 'quotes' and \"double quotes\" and <tags>";
      const jot = service.createJot({ message });

      assert.strictEqual(jot.message, message);
    });

    it('should handle duplicate tags', () => {
      const jot = service.createJot({ message: 'test', tags: ['bug', 'urgent', 'critical'] });

      assert.strictEqual(jot.tags.length, 3);
      assert.ok(jot.tags.includes('bug'));
      assert.ok(jot.tags.includes('urgent'));
      assert.ok(jot.tags.includes('critical'));
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(10000);
      const jot = service.createJot({ message: longMessage });

      assert.strictEqual(jot.message.length, 10000);
    });

    it('should handle unicode characters', () => {
      const message = '测试 🚀 émojis and spëcial çhars';
      const jot = service.createJot({ message });

      assert.strictEqual(jot.message, message);
    });
  });
});
