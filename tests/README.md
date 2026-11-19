# NutriTrace V3 test note

The label parsing and reconciliation module has no runtime dependency and can be tested using Node.js built-in test runner:

```sh
node --test tests/label-import.test.js
```

Tests cover ingredient sectioning, nutrient label variants, explicit dual-column tables, ambiguous multi-value rows, kcal/kJ handling, conflicting duplicates, conservative g/ml and portion rules, and non-destructive reconciliation. OCR character accuracy and mobile performance require a separate benchmark on a representative, consented image set; no such corpus is committed to this repository.
