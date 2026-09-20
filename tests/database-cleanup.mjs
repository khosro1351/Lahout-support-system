// pg pool.end() can finish before PostgreSQL observes the socket closing.
// Wait for disconnection rather than terminating idle clients with DROP FORCE.
export async function dropTestDatabase(admin, name) {
  if (!/^lahout_(?:test_[a-z_]*|staging_test_)\d+$/.test(name)) {
    throw new Error('Refusing to drop a non-test database');
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    const { rows } = await admin.query(
      'SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1', [name],
    );
    if (rows[0].n === 0) {
      await admin.query(`DROP DATABASE "${name}"`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Test database still has connected clients after shutdown');
}
