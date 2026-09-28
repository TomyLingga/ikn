"""Generate a Postman collection (v2.1) and environments from docs/openapi.yaml.

Run from ikn-api/ after `python docs/openapi/merge.py`:

    python docs/openapi/postman.py              # writes to <repo>/doc/postman/
    python docs/openapi/postman.py --out DIR    # custom output directory

Output:
    IKN API.postman_collection.json              all operations, grouped by area and tag
    IKN Local.postman_environment.json           dev values (localhost, seeded demo accounts)
    IKN Production (template).postman_environment.json
    README.md                                    how to import and use (Indonesian)

The collection handles Sanctum SPA auth on its own: a collection-level test script stores the
XSRF-TOKEN cookie into {{xsrfToken}} and a pre-request script sends Origin/Referer/X-XSRF-TOKEN.
List/create requests store ids (orderNumber, productSlug, mediaId, ...) for the detail requests.
No secret values are written here; gateway tokens are environment variables left empty.
"""
import argparse
import io
import json
import os
import re
import uuid

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
API_ROOT = os.path.dirname(os.path.dirname(HERE))
REPO_ROOT = os.path.dirname(API_ROOT)
SPEC = os.path.join(API_ROOT, "docs", "openapi.yaml")
DEFAULT_OUT = os.path.join(REPO_ROOT, "doc", "postman")

SCHEMA_URL = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
METHODS = ("get", "post", "put", "patch", "delete")

# Top-level folders -> tags (order matters). Tags not listed here go to "Lainnya".
GROUPS = [
    ("1 Auth & sesi", ["auth"]),
    ("2 Publik - Company profile", ["content", "forms", "regions"]),
    ("3 Publik - Katalog", ["catalog"]),
    ("4 Customer", ["customer", "geo", "cart", "orders", "payments"]),
    ("5 Admin - Company profile", ["admin-users", "admin-media", "admin-settings", "admin-cms",
                                   "admin-content", "admin-wbs", "admin-messages", "files"]),
    ("6 Admin - Toko online", ["admin-customers", "admin-catalog", "admin-commerce-config", "admin-orders",
                               "admin-payments", "admin-dashboard", "admin-reports", "admin-audit"]),
    ("7 Webhook gateway", ["webhook"]),
]

TAG_LABELS = {
    "auth": "Auth",
    "content": "Konten publik",
    "forms": "Formulir publik (WBS, kontak)",
    "regions": "Wilayah",
    "files": "Berkas privat",
    "admin-users": "Pengguna & hak akses",
    "admin-media": "Media",
    "admin-settings": "Pengaturan situs",
    "admin-cms": "Halaman, section, menu",
    "admin-content": "Berita, galeri, sertifikat, brosur",
    "admin-wbs": "Whistleblowing",
    "admin-messages": "Pesan kontak",
    "customer": "Profil & alamat",
    "geo": "Geocoding",
    "catalog": "Katalog",
    "cart": "Keranjang (quote)",
    "orders": "Order",
    "payments": "Pembayaran",
    "admin-customers": "Customer",
    "admin-catalog": "Kategori, produk, stok, ulasan",
    "admin-commerce-config": "Konfigurasi toko",
    "admin-orders": "Order",
    "admin-payments": "Verifikasi pembayaran",
    "admin-dashboard": "Dashboard",
    "admin-reports": "Laporan",
    "admin-audit": "Audit log",
    "webhook": "Webhook",
}

# Path parameter -> Postman variable / literal used as the default value.
FIXED_PATH_VALUES = {
    "number": "{{orderNumber}}",
    "provider": "xendit",
    "location": "header",
    "key": "history",
    "code": "{{wbsCode}}",
    "hash": "",
}
SLUG_BY_PREFIX = [
    ("/catalog/products", "{{productSlug}}"),
    ("/content/news", "{{newsSlug}}"),
    ("/content/pages", "home"),
]
SINGULAR = {"addresses": "address"}

# Explicit capture rules that the generic sibling-path rule cannot infer: (method, path) -> (variable, field, source)
# source: "first" = data[0], "data" = data, or a dotted path under data.
CAPTURE_OVERRIDES = {
    ("get", "/admin/pages/{page}/sections"): ("sectionId", "id", "first"),
    ("post", "/admin/pages/{page}/sections"): ("sectionId", "id", "data"),
    ("get", "/admin/shipping-zones/{shippingZone}/rates"): ("shippingRateId", "id", "first"),
    ("post", "/admin/shipping-zones/{shippingZone}/rates"): ("shippingRateId", "id", "data"),
    ("get", "/customer/orders/{number}/payments"): ("paymentId", "id", "first"),
    ("post", "/customer/orders/{number}/payments"): ("paymentId", "id", "data"),
    ("get", "/customer/orders/{number}"): ("paymentId", "id", "activePayment"),
    ("get", "/admin/orders/{number}"): ("paymentId", "id", "activePayment"),
    ("post", "/wbs"): ("wbsCode", "code", "data"),
    ("get", "/content/news"): ("newsSlug", "slug", "first"),
    ("get", "/catalog/categories"): ("categorySlug", "slug", "first"),
}

BODY_OVERRIDES = {
    "/auth/admin/login": {"email": "{{adminEmail}}", "password": "{{adminPassword}}"},
    "/auth/login": {"email": "{{customerEmail}}", "password": "{{customerPassword}}"},
}

PREREQUEST = [
    "// Sanctum SPA: kirim Origin/Referer domain FE agar sesi cookie berlaku, dan X-XSRF-TOKEN untuk request tulis.",
    "const origin = String(pm.variables.get('origin') || 'http://localhost:3000').replace(/\\/$/, '');",
    "pm.request.headers.upsert({ key: 'Origin', value: origin });",
    "pm.request.headers.upsert({ key: 'Referer', value: origin + '/' });",
    "if (!pm.request.headers.has('Accept')) pm.request.headers.upsert({ key: 'Accept', value: 'application/json' });",
    "const lang = pm.variables.get('lang');",
    "if (lang) pm.request.headers.upsert({ key: 'Accept-Language', value: lang });",
    "const xsrf = pm.variables.get('xsrfToken');",
    "if (xsrf && !pm.request.headers.has('X-XSRF-TOKEN')) pm.request.headers.upsert({ key: 'X-XSRF-TOKEN', value: xsrf });",
]

TEST_COLLECTION = [
    "// Simpan token CSRF dari cookie XSRF-TOKEN (Laravel mengirimnya di setiap respons; nilainya sudah terenkripsi).",
    "const xsrf = pm.cookies.get('XSRF-TOKEN');",
    "if (xsrf) pm.collectionVariables.set('xsrfToken', decodeURIComponent(xsrf));",
]


def load_spec():
    with io.open(SPEC, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


class Gen:
    def __init__(self, spec):
        self.spec = spec
        self.paths = spec.get("paths", {})
        self.components = spec.get("components", {})
        self.variables = {}  # captured variable names -> description

    # ------------------------------------------------------------------ schema helpers
    def resolve(self, node):
        seen = 0
        while isinstance(node, dict) and "$ref" in node and seen < 10:
            ref = node["$ref"]
            assert ref.startswith("#/"), ref
            target = self.spec
            for part in ref[2:].split("/"):
                target = target[part]
            node = target
            seen += 1
        return node if isinstance(node, dict) else {}

    def example(self, schema, depth=0):
        schema = self.resolve(schema)
        if depth > 8 or not schema:
            return None
        for key in ("example", "default"):
            if key in schema:
                return schema[key]
        if "enum" in schema and schema["enum"]:
            return schema["enum"][0]
        if "allOf" in schema:
            merged = {}
            for part in schema["allOf"]:
                value = self.example(part, depth + 1)
                if isinstance(value, dict):
                    merged.update(value)
            return merged
        for key in ("oneOf", "anyOf"):
            if key in schema and schema[key]:
                return self.example(schema[key][0], depth + 1)
        kind = schema.get("type")
        if kind == "object" or "properties" in schema:
            out = {}
            for name, prop in (schema.get("properties") or {}).items():
                prop_r = self.resolve(prop)
                if prop_r.get("readOnly"):
                    continue
                out[name] = self.example(prop, depth + 1)
            return out
        if kind == "array":
            item = self.example(schema.get("items") or {}, depth + 1)
            return [item] if item is not None else []
        if kind == "integer":
            return schema.get("minimum", 1)
        if kind == "number":
            return schema.get("minimum", 0)
        if kind == "boolean":
            return True
        if kind == "string":
            fmt = schema.get("format")
            if fmt == "email":
                return "user@example.com"
            if fmt == "date-time":
                return "2026-09-28T10:00:00+07:00"
            if fmt == "date":
                return "2026-09-28"
            if fmt in ("uri", "url"):
                return "https://example.com"
            if fmt == "binary":
                return ""
            if fmt == "password" or schema.get("title") == "password":
                return "password"
            return "string"
        return None

    # ------------------------------------------------------------------ naming helpers
    @staticmethod
    def var_for(path, param):
        if param in FIXED_PATH_VALUES:
            return FIXED_PATH_VALUES[param]
        if param == "slug":
            for prefix, value in SLUG_BY_PREFIX:
                if path.startswith(prefix):
                    return value
            return "{{slug}}"
        if param == "id":
            segments = path.split("/")
            index = segments.index("{id}") if "{id}" in segments else 0
            base = segments[index - 1] if index > 0 else "item"
            base = SINGULAR.get(base, base.rstrip("s"))
            return "{{%sId}}" % base
        return "{{%sId}}" % param

    @staticmethod
    def var_name(value):
        match = re.fullmatch(r"\{\{(\w+)\}\}", value or "")
        return match.group(1) if match else None

    def capture_for(self, method, path):
        """Return (variable, field, source) for a list/create endpoint, or None."""
        if (method, path) in CAPTURE_OVERRIDES:
            return CAPTURE_OVERRIDES[(method, path)]
        if method not in ("get", "post") or path.endswith("}"):
            return None
        prefix = path + "/{"
        for other in self.paths:
            if other.startswith(prefix):
                param = other[len(prefix):].split("}")[0]
                var = self.var_name(self.var_for(other, param))
                if not var:
                    return None
                field = "number" if param == "number" else "slug" if param == "slug" else "id"
                return (var, field, "first" if method == "get" else "data")
        return None

    @staticmethod
    def capture_script(var, field, source):
        lines = ["// Simpan nilai dari respons untuk request berikutnya", "if (pm.response.code < 300) {",
                 "  const body = pm.response.json();"]
        if source == "first":
            lines.append("  const item = Array.isArray(body.data) ? body.data[0] : null;")
        elif source == "data":
            lines.append("  const item = body.data;")
        else:
            lines.append("  const item = body.data ? body.data.%s : null;" % source)
        lines.append("  if (item && item.%s !== undefined && item.%s !== null) pm.collectionVariables.set('%s', String(item.%s));"
                     % (field, field, var, field))
        lines.append("}")
        return lines

    # ------------------------------------------------------------------ request builders
    def build_url(self, path, op):
        params = [self.resolve(p) for p in op.get("parameters", [])]
        segments = []
        variables = []
        for seg in path.strip("/").split("/"):
            match = re.fullmatch(r"\{(\w+)\}", seg)
            if match:
                name = match.group(1)
                value = self.var_for(path, name)
                param = next((p for p in params if p.get("in") == "path" and p.get("name") == name), {})
                schema = self.resolve(param.get("schema") or {})
                desc_parts = [param.get("description") or ""]
                sample = param.get("example", schema.get("example"))
                if sample is not None:
                    desc_parts.append("contoh: %s" % sample)
                if schema.get("enum"):
                    desc_parts.append("pilihan: %s" % ", ".join(map(str, schema["enum"])))
                if schema.get("enum") and value.startswith("{{"):
                    value = str(schema["enum"][0])
                variables.append({"key": name, "value": value, "description": "; ".join(p for p in desc_parts if p)})
                var = self.var_name(value)
                if var:
                    self.variables.setdefault(var, "Diisi otomatis oleh request daftar/buat terkait")
                segments.append(":" + name)
            else:
                segments.append(seg)
        query = []
        for param in params:
            if param.get("in") != "query":
                continue
            schema = self.resolve(param.get("schema") or {})
            value = param.get("example", schema.get("example", schema.get("default")))
            if value is None and schema.get("enum"):
                value = schema["enum"][0]
            if value is None:
                value = ""
            desc = param.get("description") or ""
            if schema.get("enum"):
                desc = (desc + " " if desc else "") + "(%s)" % "|".join(map(str, schema["enum"]))
            query.append({"key": param["name"], "value": str(value).lower() if isinstance(value, bool) else str(value),
                          "description": desc.strip(), "disabled": not param.get("required", False)})
        raw = "{{baseUrl}}/" + "/".join(segments)
        if any(not q["disabled"] for q in query):
            raw += "?" + "&".join("%s=%s" % (q["key"], q["value"]) for q in query if not q["disabled"])
        url = {"raw": raw, "host": ["{{baseUrl}}"], "path": segments}
        if query:
            url["query"] = query
        if variables:
            url["variable"] = variables
        return url

    def build_headers(self, op):
        headers = []
        for param in (self.resolve(p) for p in op.get("parameters", [])):
            if param.get("in") != "header":
                continue
            name = param["name"]
            value = "{{$guid}}" if name.lower() == "idempotency-key" else ""
            headers.append({"key": name, "value": value, "description": param.get("description") or ""})
        return headers

    def build_body(self, path, op):
        body = self.resolve(op.get("requestBody") or {})
        content = body.get("content") or {}
        if not content:
            return None
        if path in BODY_OVERRIDES:
            return {"mode": "raw", "raw": json.dumps(BODY_OVERRIDES[path], ensure_ascii=False, indent=2),
                    "options": {"raw": {"language": "json"}}}
        if "multipart/form-data" in content:
            media = content["multipart/form-data"]
            schema = self.resolve(media.get("schema") or {})
            required = set(schema.get("required") or [])
            items = []
            for name, prop in (schema.get("properties") or {}).items():
                prop = self.resolve(prop)
                entry = {"key": name, "description": (prop.get("description") or "").strip()}
                if prop.get("format") == "binary":
                    entry.update({"type": "file", "src": ""})
                else:
                    value = self.example(prop)
                    if isinstance(value, (dict, list)):
                        value = json.dumps(value, ensure_ascii=False)
                    entry.update({"type": "text", "value": "" if value is None else str(value).lower()
                                  if isinstance(value, bool) else str(value)})
                if name not in required:
                    entry["disabled"] = True
                items.append(entry)
            return {"mode": "formdata", "formdata": items}
        media = content.get("application/json") or next(iter(content.values()))
        if "example" in media:
            sample = media["example"]
        elif media.get("examples"):
            first = next(iter(media["examples"].values()))
            sample = first.get("value", first)
        else:
            sample = self.example(media.get("schema") or {})
        if sample is None:
            sample = {}
        return {"mode": "raw", "raw": json.dumps(sample, ensure_ascii=False, indent=2),
                "options": {"raw": {"language": "json"}}}

    @staticmethod
    def request_name(method, path, op):
        summary = (op.get("summary") or "").strip()
        if summary:
            short = re.split(r"\s+[—–-]\s+|\.\s|\s\(", summary, maxsplit=1)[0].strip().rstrip(".")
            if len(short) > 70:
                short = short[:67].rstrip() + "..."
            return short
        return "%s %s" % (method.upper(), path)

    def describe(self, method, path, op):
        lines = ["**%s** `%s`" % (method.upper(), path)]
        if op.get("summary"):
            lines += ["", op["summary"].strip()]
        if op.get("description"):
            lines += ["", op["description"].strip()]
        lines += ["", "Auth: " + ("sesi cookie (login dulu)" if op.get("security") else "publik")]
        responses = op.get("responses") or {}
        if responses:
            lines += ["", "Respons:"]
            for code, resp in responses.items():
                resp = self.resolve(resp)
                lines.append("- `%s` %s" % (code, (resp.get("description") or "").strip()))
        return "\n".join(lines)

    def build_request(self, method, path, op):
        item = {
            "name": self.request_name(method, path, op),
            "request": {
                "method": method.upper(),
                "header": self.build_headers(op),
                "url": self.build_url(path, op),
                "description": self.describe(method, path, op),
            },
            "response": [],
        }
        body = self.build_body(path, op)
        if body:
            item["request"]["body"] = body
        if path.startswith("/payments/webhook/"):
            item["request"]["header"].append({
                "key": "x-callback-token", "value": "{{xenditCallbackToken}}",
                "description": "Isi dari variabel lingkungan; nilai aslinya = XENDIT_CALLBACK_TOKEN di .env server",
            })
        capture = self.capture_for(method, path)
        if capture:
            var, field, source = capture
            self.variables.setdefault(var, "Diisi otomatis oleh request daftar/buat terkait")
            item["event"] = [{"listen": "test", "script": {"type": "text/javascript",
                                                            "exec": self.capture_script(var, field, source)}}]
        return item

    @staticmethod
    def dedupe_names(items):
        counts = {}
        for item in items:
            counts[item["name"]] = counts.get(item["name"], 0) + 1
        for item in items:
            if counts[item["name"]] > 1:
                url = item["request"]["url"]
                item["name"] = "%s %s" % (item["request"]["method"], "/" + "/".join(url["path"]))

    def substitute_ids(self, item):
        """Point id-like fields of JSON bodies to the captured collection variables ("productId": {{productId}})."""
        body = item["request"].get("body")
        if not body or body.get("mode") != "raw":
            return
        raw = body["raw"]
        for var in self.variables:
            raw = re.sub(r'("%s"\s*:\s*)(\d+)(?=\s*[,\n}])' % var, r"\1{{%s}}" % var, raw)
            raw = re.sub(r'("%s"\s*:\s*)"string"' % var, r'\1"{{%s}}"' % var, raw)
        body["raw"] = raw

    # ------------------------------------------------------------------ collection
    def setup_folder(self):
        csrf = {
            "name": "CSRF cookie (jalankan pertama)",
            "request": {
                "method": "GET",
                "header": [],
                "url": {"raw": "{{host}}/sanctum/csrf-cookie", "host": ["{{host}}"], "path": ["sanctum", "csrf-cookie"]},
                "description": "Mengambil cookie `XSRF-TOKEN` + `laravel_session`. Skrip test koleksi menyimpan token ke "
                               "`{{xsrfToken}}`; setelah itu semua request tulis (POST/PUT/DELETE) otomatis membawa header "
                               "`X-XSRF-TOKEN`. Jalankan ulang setelah logout atau bila mendapat 419.",
            },
            "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": [
                "pm.test('CSRF cookie diterima (204)', () => pm.response.to.have.status(204));",
                "pm.test('xsrfToken tersimpan', () => pm.expect(pm.collectionVariables.get('xsrfToken')).to.be.a('string').and.not.empty);",
            ]}}],
            "response": [],
        }
        items = [csrf]
        ping = self.paths.get("/ping", {}).get("get")
        if ping:
            items.append(self.build_request("get", "/ping", ping))
        return {"name": "0 Setup", "description": "Jalankan `CSRF cookie` sekali sebelum login. Cookie sesi dikelola Postman "
                                                   "secara otomatis (cookie jar).", "item": items}

    def build(self):
        by_tag = {}
        for path, ops in self.paths.items():
            for method, op in ops.items():
                if method not in METHODS or path == "/ping":
                    continue
                tags = op.get("tags") or ["lainnya"]
                by_tag.setdefault(tags[0], []).append(self.build_request(method, path, op))
        tag_desc = {t.get("name"): t.get("description") or "" for t in self.spec.get("tags", [])}
        for items in by_tag.values():
            self.dedupe_names(items)
            for item in items:
                self.substitute_ids(item)

        folders = [self.setup_folder()]
        used = set()
        for group_name, tags in GROUPS:
            sub = []
            for tag in tags:
                if tag in by_tag:
                    sub.append({"name": TAG_LABELS.get(tag, tag), "description": tag_desc.get(tag, ""), "item": by_tag[tag]})
                    used.add(tag)
            if sub:
                folders.append({"name": group_name, "item": sub})
        leftovers = [{"name": TAG_LABELS.get(t, t), "description": tag_desc.get(t, ""), "item": items}
                     for t, items in by_tag.items() if t not in used]
        if leftovers:
            folders.append({"name": "9 Lainnya", "item": leftovers})

        info = self.spec.get("info", {})
        description = (info.get("description") or "").strip() + (
            "\n\n### Cara pakai\n"
            "1. Pilih environment `IKN Local` (atau salin `IKN Production (template)`).\n"
            "2. Jalankan `0 Setup > CSRF cookie`.\n"
            "3. Login lewat `1 Auth & sesi` (admin atau customer). Cookie sesi tersimpan di cookie jar Postman.\n"
            "4. Request daftar/buat menyimpan id ke variabel koleksi (`orderNumber`, `productSlug`, `mediaId`, ...) "
            "sehingga request detail bisa langsung dijalankan.\n\n"
            "Header `Origin`, `Referer`, `Accept`, `Accept-Language`, dan `X-XSRF-TOKEN` diisi skrip pre-request koleksi. "
            "Dibuat otomatis oleh `ikn-api/docs/openapi/postman.py` dari `docs/openapi.yaml`; jangan diedit manual."
        )
        variables = [
            {"key": "host", "value": "http://localhost:8000", "type": "string",
             "description": "Origin API tanpa prefix (dipakai /sanctum/csrf-cookie); environment menimpa nilai ini"},
            {"key": "baseUrl", "value": "{{host}}/api/v1", "type": "string", "description": "Prefix semua endpoint"},
            {"key": "origin", "value": "http://localhost:3000", "type": "string",
             "description": "Origin FE yang terdaftar di SANCTUM_STATEFUL_DOMAINS"},
            {"key": "lang", "value": "id", "type": "string", "description": "Accept-Language: id | en"},
            {"key": "xsrfToken", "value": "", "type": "string", "description": "Diisi otomatis dari cookie XSRF-TOKEN"},
        ]
        for name in sorted(self.variables):
            variables.append({"key": name, "value": "", "type": "string", "description": self.variables[name]})

        return {
            "info": {
                "_postman_id": str(uuid.uuid5(uuid.NAMESPACE_URL, "ikn-api-collection")),
                "name": info.get("title", "IKN API"),
                "description": description,
                "schema": SCHEMA_URL,
                "version": info.get("version", "1.0.0"),
            },
            "item": folders,
            "event": [
                {"listen": "prerequest", "script": {"type": "text/javascript", "exec": PREREQUEST}},
                {"listen": "test", "script": {"type": "text/javascript", "exec": TEST_COLLECTION}},
            ],
            "variable": variables,
        }


def environment(name, values):
    return {
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, "ikn-env-" + name)),
        "name": name,
        "values": [{"key": k, "value": v, "type": t, "enabled": True} for k, v, t in values],
        "_postman_variable_scope": "environment",
    }


LOCAL_ENV = [
    ("host", "http://localhost:8000", "default"),
    ("origin", "http://localhost:3000", "default"),
    ("lang", "id", "default"),
    ("adminEmail", "superadmin@ptikn.com", "default"),
    ("adminPassword", "password", "secret"),
    ("customerEmail", "buyer@coatingsolutions.co.id", "default"),
    ("customerPassword", "password", "secret"),
    ("xenditCallbackToken", "", "secret"),
]
PROD_ENV = [
    ("host", "https://api.ganti-domain.example", "default"),
    ("origin", "https://www.ganti-domain.example", "default"),
    ("lang", "id", "default"),
    ("adminEmail", "", "default"),
    ("adminPassword", "", "secret"),
    ("customerEmail", "", "default"),
    ("customerPassword", "", "secret"),
    ("xenditCallbackToken", "", "secret"),
]

README = """# Postman collection IKN API

Berkas di folder ini dibuat otomatis dari `ikn-api/docs/openapi.yaml` oleh `ikn-api/docs/openapi/postman.py`.
Jangan diedit manual; bila kontrak API berubah, jalankan ulang dari folder `ikn-api/`:

```bash
python docs/openapi/merge.py      # gabungkan fragmen OpenAPI
python docs/openapi/postman.py    # tulis ulang folder ini
```

| Berkas | Isi |
|---|---|
| `IKN API.postman_collection.json` | {count} request dalam folder per area (setup, auth, publik, customer, admin, webhook) |
| `IKN Local.postman_environment.json` | nilai dev: `http://localhost:8000`, origin FE `http://localhost:3000`, akun demo seeder |
| `IKN Production (template).postman_environment.json` | kerangka untuk server produksi; isi host dan akun sendiri |

## Impor

1. Postman > **Import** > pilih ketiga berkas JSON.
2. Pilih environment **IKN Local** di pojok kanan atas.
3. Pastikan `ikn-api` berjalan (`php artisan serve --port=8000`).

## Alur login (Sanctum cookie SPA)

API memakai sesi cookie, bukan bearer token. Koleksi ini sudah menangani itu:

1. Jalankan **0 Setup > CSRF cookie**. Skrip test menyimpan cookie `XSRF-TOKEN` ke variabel `xsrfToken`.
2. Jalankan **1 Auth & sesi > Login admin** (memakai `adminEmail`/`adminPassword`) atau **Login customer**.
   Cookie `laravel_session` disimpan Postman di cookie jar dan dikirim otomatis pada request berikutnya.
3. Skrip pre-request koleksi menambahkan header `Origin`, `Referer` (domain FE), `Accept`, `Accept-Language`, dan
   `X-XSRF-TOKEN` ke setiap request. Tanpa `Origin` domain FE, Sanctum tidak memperlakukan request sebagai sesi.
4. Bila mendapat **419** (token kedaluwarsa) atau setelah **Logout**, jalankan lagi **CSRF cookie**.

Sesi admin dan customer berbeda user pada sesi yang sama; login sebagai admin lalu customer akan mengganti sesi.
Gunakan dua Postman workspace atau logout dulu bila perlu keduanya bergantian.

## Variabel yang diisi otomatis

Request daftar (`GET`) dan buat (`POST`) menyimpan nilai pertama dari respons ke variabel koleksi, misalnya:

| Request | Variabel |
|---|---|
| `GET /catalog/products` | `productSlug`, `productId` |
| `GET /customer/addresses`, `POST /customer/addresses` | `addressId` |
| `POST /customer/orders`, `GET /customer/orders`, `GET /admin/orders` | `orderNumber` |
| `GET /customer/orders/{{number}}`, `GET /admin/payments` | `paymentId` |
| `POST /admin/media`, `GET /admin/media` | `mediaId` |
| `GET /admin/products`, `GET /admin/categories`, `GET /admin/vouchers`, dst. | `productId`, `categoryId`, `voucherId`, dst. |

Request detail memakai variabel itu pada path (`:number` = `{{{{orderNumber}}}}`). Nilainya bisa diubah manual di tab
**Variables** koleksi.

## Contoh urutan uji checkout

1. `0 Setup > CSRF cookie`, lalu `1 Auth & sesi > Login customer`.
2. `3 Publik - Katalog > GET /catalog/products` (mengisi `productId`).
3. `4 Customer > Profil & alamat > GET /customer/addresses` (mengisi `addressId`).
4. `4 Customer > Keranjang (quote) > POST /cart/quote`: ganti `productId`, `addressId`, `paymentMethodCode` di body.
5. `4 Customer > Order > Checkout` (`POST /customer/orders`): header `Idempotency-Key` diisi `{{{{$guid}}}}` otomatis;
   kirim ulang dengan nilai yang sama mengembalikan order yang sama dengan 200.
6. `4 Customer > Pembayaran > Unggah bukti bayar`: pilih berkas pada field `file` (jpg/png/pdf, maks 5 MB).
7. Logout, login admin, lalu `6 Admin - Toko online > Verifikasi pembayaran > accept`.

## Unggah berkas

Request `multipart/form-data` (media, bukti bayar, lampiran WBS, panduan admin) memakai body **form-data**; field
bertipe file harus dipilih manual dari komputer Anda karena Postman tidak menyimpan berkas di koleksi.

## Webhook gateway

`7 Webhook gateway > POST /payments/webhook/xendit` mengirim header `x-callback-token` dari variabel environment
`xenditCallbackToken`. Isi variabel itu dengan nilai `XENDIT_CALLBACK_TOKEN` milik server yang diuji; jangan simpan
nilainya di berkas ini atau di repositori.

## Keamanan

- Berkas environment lokal hanya memuat akun demo seeder (`password`). Untuk produksi, isi environment di Postman
  dan jangan ekspor kembali ke repositori.
- Folder `doc/` tidak ikut git (`.gitignore`).
"""


def count_requests(items):
    total = 0
    for item in items:
        if "item" in item:
            total += count_requests(item["item"])
        else:
            total += 1
    return total


def write_json(path, payload):
    with io.open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default=DEFAULT_OUT, help="output directory (default: <repo>/doc/postman)")
    args = parser.parse_args()

    spec = load_spec()
    collection = Gen(spec).build()
    os.makedirs(args.out, exist_ok=True)

    write_json(os.path.join(args.out, "IKN API.postman_collection.json"), collection)
    write_json(os.path.join(args.out, "IKN Local.postman_environment.json"), environment("IKN Local", LOCAL_ENV))
    write_json(os.path.join(args.out, "IKN Production (template).postman_environment.json"),
               environment("IKN Production (template)", PROD_ENV))
    total = count_requests(collection["item"])
    with io.open(os.path.join(args.out, "README.md"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(README.format(count=total))
    print("wrote %d requests, %d variables -> %s" % (total, len(collection["variable"]), os.path.relpath(args.out, REPO_ROOT)))


if __name__ == "__main__":
    main()
