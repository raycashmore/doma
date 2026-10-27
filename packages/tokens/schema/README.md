# Vendored DTCG schema

`dtcg-2025.10-format.json` is the unmodified public snapshot fetched on 27 October 2026 from [DTCG 2025.10 format schema](https://www.designtokens.org/schemas/2025.10/format.json). Its SHA-256 is `32e93b780e4e4bca778d0780cb797a560deedc470c608af16576223f7e42915f`.

The bundled definitions include their own IDs. Ajv validates offline with ajv-formats; no remote schema fetching occurs. Doma then applies its narrower explicit-type, sRGB/layout-px/whole-alias profile. Passing this profile does not claim support for every DTCG feature. Review schema updates separately from token changes.
