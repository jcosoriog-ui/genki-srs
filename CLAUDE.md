# Genki App — datos de vocabulario y kanji

Proyecto para construir una app de estudio de japonés basada en **GENKI I y II (3ª edición)**.
Las fuentes son los PDF en
`~/Library/CloudStorage/OneDrive-Personal/03. Recursos/Japones/Sayaka-san の日本語/Genki/`.

**Antes de cambiar la app, lee [DISENO.md](DISENO.md)**: decisiones tomadas con el usuario, diseño del SRS, limitaciones y pendientes. Actualízalo al cerrar cada sesión de trabajo.

## Datos (`data/`)

Cada tabla existe en JSON (fuente principal para la app) y en CSV (para revisar en Excel/Numbers).

### `vocabulary.json` / `.csv` — 1.774 palabras (L1–L23 + saludos)

Fuente: el índice J-E de Genki 2 (pp. 352–367), que cubre ambos libros. Se verificó contra el índice de Genki 1.

| campo | significado |
|---|---|
| `id` | id estable (orden del índice あいうえお) |
| `kana` | lectura en kana (headword del índice). Puede incluir `～` o `（な）` |
| `kanji` | forma escrita con kanji según el libro (vacío si el libro solo la da en kana) |
| `meaning_en` | significado en inglés, tal como aparece en el libro |
| `meaning_es` | significado en español (traducción propia, desde `data/es/`) |
| `word_type` | `u-verb`, `ru-verb`, `irregular verb` o vacío |
| `book` | 1 o 2 (según la primera lección en que aparece) |
| `lesson` | primera lección en que aparece (1–23; `null` para saludos) |
| `section` | `会` = Conversación y Gramática, `読` = Lectura y Escritura, `G` = Saludos (あいさつ) |
| `useful_expression` | `true` si viene de la sección "Useful Expressions" (etiqueta `(e)`) |
| `exercise` | número de ejercicio de lectura (`I`/`II`/`III`) cuando `section` = `読` |
| `all_lessons` | todas las etiquetas de lección del índice, p. ej. `会L9, 会L9(e)` |
| `example_ja` | oración de ejemplo tomada del texto de los libros que usa la palabra (vacío en 240 palabras que solo aparecen en listas de vocabulario) |
| `example_book` / `example_lesson` / `example_section` / `example_page` | de dónde salió el ejemplo (`example_page` = número de página impreso) |
| `example_from_ocr` | `true` si el ejemplo viene del OCR de Genki 1 (el PDF de Genki 1 es solo imagen) y puede tener errores puntuales |

### `kanji.json` / `.csv` — 317 kanji (n.º 1–145 de Genki 1 L3–L12, 146–317 de Genki 2 L13–L23)

| campo | significado |
|---|---|
| `number` | número de kanji en el libro (001–317) |
| `kanji`, `book`, `lesson`, `page` | dónde se enseña (página impresa) |
| `meaning_en` / `meaning_es` | significado (inglés del libro / traducción al español) |
| `on_yomi` / `kun_yomi` | lista de lecturas (▶ on / ▷ kun en el libro) |
| `strokes` | número de trazos |
| `compounds` | palabras de ejemplo de la tabla del libro: `[{word, reading, meaning, meaning_es}]` (en el CSV: `palabra（lectura）significado ／ …`) |
| `example_ja` + `example_*` | oración del texto del libro que contiene el kanji (mismo esquema que en vocabulario) |

`genki1_kanji_transcription.txt` es la transcripción manual (revisada a ojo contra las páginas) de las tablas de kanji de Genki 1. Formato: `lección|n.º|kanji|on|kun|significado|trazos|compuestos`.

## Notas de calidad
- Genki 2 tiene texto real; vocabulario, kanji y ejemplos de Genki 2 son exactos.
- Genki 1 es solo imagen: los kanji se transcribieron a mano; los ejemplos de Genki 1 salieron de OCR (Apple Vision) con filtros contra el ruido de furigana. Revisa los ejemplos con `example_from_ocr: true` antes de darlos por buenos.
- Las traducciones al español viven en `data/es/` (`vocab_es_*.tsv` por id, `kanji_es.tsv` por número, `compounds_en_es.tsv` inglés→español). Corrige ahí y vuelve a ejecutar `merge_es.py`.
- Sinónimos: si dos palabras deben no competir como distractores, dales el mismo texto principal en español y distínguelas con un paréntesis (p. ej. ids 1319/1715/1146 «Mucho gusto. (…)»).

## Regenerar (`scripts/`)
Extracción (requiere PyMuPDF y macOS Vision): `extract.py` → `ocr.swift` → `parse_idx.py`, `g2kanji.py`, `g2text.py` → `corpus.py` → `build.py data` (los intermedios en el mismo directorio de trabajo). Después siempre: `python3 scripts/merge_es.py` y `python3 scripts/build_app_data.py`.

## App (`docs/`) — PWA para iPhone, publicada con GitHub Pages desde `/docs`
- Sin dependencias ni build: `index.html`, `styles.css`, `app.js`, `data.js` (generado por `build_app_data.py`), `sw.js` (offline), `manifest.webmanifest`, `icons/`.
- **Al publicar cambios, sube `VERSION` en `docs/sw.js`** o los iPhone seguirán con la versión en caché.
- Progreso en `localStorage` (clave `genki-srs-v1`), con exportar/importar en Ajustes.
- SRS (`app.js`): etapas 0–9; intervalos 4 h, 8 h, 1 d, 2 d, 1 sem, 2 sem, 1 mes, 4 meses; etapa 9 = dominada (sale de la rotación). Fallo → −2 etapas y se repite en la misma sesión. Etapas 0–1: opción múltiple (4); etapa 2: inversa (español→japonés, solo vocabulario); ≥3: recuerdo activo con autoevaluación (Otra vez/Bien/Fácil).
- Qué estudiar (`state.study`): tipo `vocab` / `kanji` / `mix` y cualquier conjunto de lecciones 1–23 (kanji: L3–L23). No hay bloqueo de lecciones; la «lección sugerida» es la primera con <80% en etapa ≥5. Saludos (G) van con la L1; las «Useful Expressions» (e) están desactivadas por defecto.
- Sesión sin límite diario: repasos pendientes de la selección → bloques de 5 nuevas (presentación y luego examen) → práctica extra (10 tarjetas, las menos consolidadas primero; acertar no cambia intervalos, fallar sí). Termina cuando el usuario pulsa «Terminar».
- Tarjeta de kanji: compuestos de la tabla del libro, palabras del vocabulario que contienen el kanji (`VOCAB_BY_KANJI`) y oración del libro, con el kanji resaltado. Tarjeta de vocabulario: desglose de sus kanji de Genki.
- Probar en local: `python3 -m http.server 8765 --directory docs`.

