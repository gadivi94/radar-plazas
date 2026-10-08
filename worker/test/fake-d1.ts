// D1 en memoria sobre bun:sqlite, suficiente para probar el ciclo completo.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";

class Stmt {
  constructor(private db: Database, private sql: string, private params: unknown[] = []) {}
  bind(...p: unknown[]) { return new Stmt(this.db, this.sql, p); }
  async all<T>() { return { results: this.db.query(this.sql).all(...(this.params as never[])) as T[] }; }
  async first<T>() { return (this.db.query(this.sql).get(...(this.params as never[])) as T) ?? null; }
  async run() { const r = this.db.query(this.sql).run(...(this.params as never[])); return { meta: { changes: r.changes } }; }
}

export function fakeD1() {
  const db = new Database(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  return {
    raw: db,
    prepare: (sql: string) => new Stmt(db, sql),
    batch: async (stmts: Stmt[]) => Promise.all(stmts.map((s) => s.run())),
  };
}
