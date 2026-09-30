BEGIN;
-- Existing document bytes and immutable snapshots remain untouched.
ALTER TABLE family.documents ALTER COLUMN content DROP NOT NULL;
CREATE TABLE family.document_series(
 id uuid PRIMARY KEY, family_id uuid NOT NULL REFERENCES family.families(id),
 current_document_id uuid NOT NULL REFERENCES family.documents(id),
 archived boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES identity.accounts(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE family.document_versions(
 document_id uuid PRIMARY KEY REFERENCES family.documents(id),
 series_id uuid NOT NULL REFERENCES family.document_series(id),
 revision integer NOT NULL CHECK(revision>0),
 request_id uuid NOT NULL UNIQUE, request_hash text NOT NULL,
 created_by uuid NOT NULL REFERENCES identity.accounts(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(series_id,revision)
);
CREATE TABLE family.document_files(
 id uuid PRIMARY KEY,document_id uuid NOT NULL REFERENCES family.documents(id),
 position integer NOT NULL CHECK(position>0),
 original_name text NOT NULL, media_type text NOT NULL,
 original_size integer NOT NULL CHECK(original_size>0),stored_size integer NOT NULL CHECK(stored_size>0),
 sha256 text NOT NULL,storage_key text NOT NULL CHECK(storage_key ~ '^[0-9a-f-]{36}$'),
 pdf_pages integer NOT NULL DEFAULT 1 CHECK(pdf_pages>0),
 UNIQUE(document_id,position)
);
CREATE INDEX document_files_storage ON family.document_files(storage_key);
CREATE TRIGGER document_series_no_delete BEFORE DELETE ON family.document_series FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER document_versions_immutable BEFORE UPDATE OR DELETE ON family.document_versions FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE TRIGGER document_files_immutable BEFORE UPDATE OR DELETE ON family.document_files FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE TRIGGER document_series_import_activity AFTER INSERT OR UPDATE ON family.document_series FOR EACH ROW EXECUTE FUNCTION family_import.track_activity();
COMMIT;
