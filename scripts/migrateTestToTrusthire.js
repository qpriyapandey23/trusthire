'use strict';

const mongoose = require('mongoose');

async function migrateData() {
  console.log('[Migration] Connecting to MongoDB...');
  const conn = await mongoose.connect('mongodb://127.0.0.1:27017');
  
  const sourceDb = conn.connection.useDb('test');
  const targetDb = conn.connection.useDb('trusthire');

  const collections = ['users', 'studentprofiles', 'scorehistories', 'scoreboostertasks'];

  for (const colName of collections) {
    const srcCol = sourceDb.db.collection(colName);
    const tgtCol = targetDb.db.collection(colName);

    const docs = await srcCol.find({}).toArray();
    console.log(`[Migration] Copying ${docs.length} documents from test.${colName} -> trusthire.${colName}...`);

    for (const doc of docs) {
      await tgtCol.replaceOne({ _id: doc._id }, doc, { upsert: true });
    }

    try {
      const indexes = await srcCol.indexes();
      for (const idx of indexes) {
        if (idx.name === '_id_') continue;
        const keys = idx.key;
        const opts = {};
        if (idx.unique) opts.unique = true;
        if (idx.name) opts.name = idx.name;
        if (idx.sparse) opts.sparse = true;
        await tgtCol.createIndex(keys, opts);
      }
    } catch (idxErr) {
      console.warn(`[Migration] Index setup warning on ${colName}:`, idxErr.message);
    }

    const count = await tgtCol.countDocuments();
    console.log(`[Migration] Verified trusthire.${colName} document count: ${count}`);
  }

  await mongoose.disconnect();
  console.log('[Migration] All data safely copied to trusthire database.');
}

migrateData().catch((err) => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
