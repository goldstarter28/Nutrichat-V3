# NutriTrace label parser tests

Run the dependency-free Node.js test suite with:

```sh
node --test tests/label-import.test.js
```

Coverage includes ingredient sectioning, Italian and English nutrient aliases, explicit multi-column tables, ambiguous values, malformed rows and units, identical and conflicting duplicate nutrients, kcal/kJ handling, conservative per-100-ml and serving rules, missing nutrients, and non-destructive reconciliation. OCR character accuracy and mobile performance require separate benchmarks against a representative, consented image set; no such corpus is committed to this repository.
