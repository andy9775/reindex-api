import uuid from 'uuid';
import RethinkDB from 'rethinkdb';

import { TIMESTAMP } from '../../../../graphQL/builtins/DateTime';
import { getConnection, releaseConnection } from '../../dbConnections';
import { TYPE_TABLE } from '../../DBTableNames';
import assert from '../../../../test/assert';
import DatabaseTypes from '../../../DatabaseTypes';
import {
  createTestDatabase,
  deleteTestDatabase,
} from './testDatabase';
import { getByID } from '../simpleQueries';
import * as queries from '../mutationQueries';
import { queryWithIDs } from '../queryUtils';

if (process.env.DATABASE_TYPE === DatabaseTypes.RethinkDB) {
  describe('RethinkDB: Mutatative database queries', () => {
    const db = 'testdb' + uuid.v4().replace(/-/g, '_');
    let conn;

    before(async function () {
      conn = await getConnection(db);
      await createTestDatabase(conn, db);
    });

    after(async function () {
      await deleteTestDatabase(conn, db);
      await releaseConnection(conn);
    });

    describe('CRUD', () => {
      let id;

      it('create', async function() {
        const result = await queries.create(conn, 'User', {
          handle: 'villeimmonen',
        });
        id = result.id;
        const resultInDb = await getByID(conn, 'User', id);
        assert.deepEqual(
          result,
          resultInDb
        );
        assert.deepEqual(resultInDb, {
          id,
          handle: 'villeimmonen',
        });
      });

      it('update', async function() {
        const result = await queries.update(conn, 'User', id, {
          handle: 'immonenville',
          email: 'immonenv@example.com',
        });
        const resultInDb = await getByID(conn, 'User', id);
        assert.deepEqual(
          result,
          resultInDb
        );
        assert.deepEqual(resultInDb, {
          id,
          handle: 'immonenville',
          email: 'immonenv@example.com',
        });
      });

      it('replace', async function() {
        const result = await queries.replace(conn, 'User', id, {
          handle: 'villeimmonen',
        });
        const resultInDb = await getByID(conn, 'User', id);
        assert.deepEqual(
          result,
          resultInDb
        );
        assert.deepEqual(resultInDb, {
          id,
          handle: 'villeimmonen',
        });
      });

      it('delete', async function() {
        const result = await queries.deleteQuery(conn, 'User', id, {
          handle: 'villeimmonen',
        });
        const resultInDb = await getByID(conn, 'User', id);
        assert.isNull(
          resultInDb
        );
        assert.deepEqual(result, {
          id,
          handle: 'villeimmonen',
        });
      });
    });

    it('create and delete type', async function() {
      const newNodeType = {
        name: 'NewNodeType',
        kind: 'OBJECT',
        interfaces: ['Node'],
        fields: [
          {
            name: 'id',
            type: 'ID',
            nonNull: true,
          },
        ],
      };
      const newType = {
        name: 'NewType',
        kind: 'OBJECT',
        interfaces: [],
        fields: [],
      };

      const nodeResult = await queries.createType(conn, newNodeType);
      const result = await queries.createType(conn, newType);
      const tables = await RethinkDB.tableList().run(conn);

      assert(tables.includes('NewNodeType'),
        'Node type is created as table');
      assert(!tables.includes('NewType'),
        'non-Node type is not created as table');

      assert.deepEqual(nodeResult, await queryWithIDs(
        'ReindexType',
        RethinkDB.table(TYPE_TABLE).filter({
          name: 'NewNodeType',
        })(0)).run(conn)
      );
      assert.deepEqual(result, await queryWithIDs(
        'ReindexType',
        RethinkDB.table(TYPE_TABLE).filter({
          name: 'NewType',
        })(0)).run(conn)
      );

      await queries.deleteType(conn, nodeResult.id);
      await queries.deleteType(conn, result.id);
      const afterDeleteTables = await RethinkDB.tableList().run(conn);

      assert(!afterDeleteTables.includes('NewNodeType'),
        'Node type is delete as table');
      assert(!afterDeleteTables.includes('NewType'),
        'non-Node type is still not a table');

      assert.equal(0, await RethinkDB.table(TYPE_TABLE).filter({
        name: 'NewNodeType',
      }).count().run(conn));
      assert.equal(0, await RethinkDB.table(TYPE_TABLE).filter({
        name: 'NewType',
      }).count().run(conn));
    });

    it('converts special values', async () => {
      const newMicropost = {
        text: 'test',
        createdAt: TIMESTAMP,
      };
      const result = await queries.create(conn, 'Micropost', newMicropost);
      assert.instanceOf(result.createdAt, Date);
    });
  });
}
