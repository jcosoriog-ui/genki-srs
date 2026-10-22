# Genki SRS — documento de diseño

Última actualización: 2026-10-21 · commit `b168da5` · repositorio `jcosoriog-ui/genki-srs` (privado)

Este documento reúne el contexto, las decisiones tomadas y su porqué, el diseño actual y los pendientes, para retomar el trabajo en otra sesión. Los detalles de los datos (campos, scripts de extracción) están en [CLAUDE.md](CLAUDE.md).

---

## 1. Objetivo

App para el iPhone del autor que sirve para aprender el **vocabulario** y los **kanji** de *Genki I* y *Genki II* (3.ª edición) con **repetición espaciada** (SRS):

- Tarjetas que muestran el kanji (si la palabra lo tiene) o el texto en kana, y piden el significado.
- Lo que se responde bien una y otra vez va desapareciendo de los repasos; lo que se falla sigue saliendo.
- Organizada por las lecciones de Genki (L1–L23). Se puede estudiar en orden, pero el estudiante elige libremente qué lecciones estudiar.

Usuario: hispanohablante que estudia con los libros Genki. La interfaz y los significados están en español.

## 2. Estado actual

| Pieza | Estado |
|---|---|
| Datos extraídos (1.774 palabras, 317 kanji) | Hechos, en `data/` |
| Traducción al español | Hecha (traducción propia, no del libro), en `data/es/` |
| App PWA en `docs/` | Funcionando; probada en el navegador a tamaño de iPhone |
| GitHub | Código subido a `main` |
| GitHub Pages | **Sin confirmar.** El repositorio es privado y con una cuenta gratuita Pages no publica repositorios privados. Hay que decidir entre hacerlo público o pagar GitHub Pro |
| Prueba en un iPhone real | **Pendiente** |

## 3. Decisiones tomadas (y por qué)

| # | Decisión | Alternativas descartadas | Motivo |
|---|---|---|---|
| D1 | **PWA** (web app instalable desde Safari con «Añadir a pantalla de inicio») | App nativa SwiftUI; Artifact de claude.ai | El Mac no tiene Xcode. Una app nativa con cuenta gratuita de Apple hay que reinstalarla cada 7 días. La PWA funciona sin conexión y se actualiza sola |
| D2 | Hospedaje en **GitHub Pages** desde `/docs` en `main` | Netlify, claude.ai | Elegido por el usuario. Gratis y se actualiza con un `git push` |
| D3 | Significados en **español**; el inglés del libro se ve debajo, en pequeño | Solo inglés | Elegido por el usuario |
| D4 | Ejercicio en etapas: **opción múltiple (4 opciones) → inversa → recuerdo activo con autoevaluación** | Solo opción múltiple con 3 o 4 opciones | Reconocer es más fácil que recordar, y recordar fija mejor. Con 4 opciones el acierto por azar baja del 33% al 25% |
| D5 | Las tarjetas nuevas se **presentan antes de evaluarlas**, en bloques de 5 | Evaluar desde la primera vez | No tiene sentido adivinar una palabra que nunca se ha visto |
| D6 | **Sin límite diario** de tarjetas nuevas. La sesión sigue hasta que el usuario pulsa «Terminar» | 15 nuevas al día (versión inicial) | Pedido por el usuario el 2026-10-21 |
| D7 | **El estudiante elige el tipo** (Vocabulario / Kanji / Ambos) **y una o varias lecciones** | Solo la lección actual | Pedido por el usuario el 2026-10-21 |
| D8 | **Sin bloqueo de lecciones.** Se muestra una «lección sugerida»: la primera con menos del 80% consolidado | Desbloqueo progresivo al consolidar el 80% (versión inicial) | Elegido por el usuario al pedir la selección libre |
| D9 | Tarjeta de kanji con **compuestos del libro + palabras del vocabulario que lo usan + oración del libro**, con el kanji resaltado. Tarjeta de vocabulario con **desglose de sus kanji** | Solo 5 compuestos | Elegido por el usuario: «ejemplos con los kanji que estás estudiando» |
| D10 | Saludos (あいさつ, etiqueta G) se estudian con la L1. Las «Useful Expressions» (277 palabras) quedan **desactivadas por defecto** (se activan en Ajustes) | Incluirlas siempre | En Genki son vocabulario opcional |
| D11 | Furigana en modo «Auto»: solo sobre los kanji cuya tarjeta de kanji no está en etapa ≥3 | Siempre / nunca | Imita a Genki, que escribe en kanji lo ya estudiado |
| D12 | Progreso en `localStorage` del teléfono, con exportar/importar JSON | Sincronización en la nube | Simple, sin servidor ni cuentas. Contra: no se sincroniza entre dispositivos (ver pendientes) |

## 4. Diseño del SRS

Cada tarjeta guarda `{ s: etapa, due: próximo repaso (ms) | null, reps, lapses, last }`.

| Etapa | Nivel | Siguiente repaso tras acertar | Ejercicio |
|---|---|---|---|
| 0 | nueva (recién presentada) | 4 h | opción múltiple JP→ES |
| 1 | Aprendiz | 8 h | opción múltiple JP→ES |
| 2 | Aprendiz | 1 día | vocabulario: inversa ES→JP (4 opciones); kanji: opción múltiple |
| 3–4 | Aprendiz | 2 días / 1 semana | recuerdo activo (Otra vez / Bien / Fácil) |
| 5–6 | Consolidada | 2 semanas / 1 mes | recuerdo activo |
| 7–8 | Experta | 4 meses / dominada | recuerdo activo |
| 9 | **Dominada** | — sale de la rotación | — |

Reglas:
- **Acertar:** +1 etapa («Fácil»: +2).
- **Fallar:** −2 etapas (mínimo 1) y `lapses+1`. La tarjeta vuelve a salir en la misma sesión, 4–6 tarjetas más tarde, en opción múltiple. Al acertarla ahí, toma el intervalo de su nueva etapa, sin subir.
- **Consolidada** (etapa ≥5) es la medida de avance de cada lección y de la lección sugerida (80%).
- El día cambia a las 4:00 (para la racha y las estadísticas de «hoy»).

### Flujo de una sesión (sin fin)
1. Repasos pendientes de la selección (tipo + lecciones), en orden aleatorio.
2. Nuevas de la selección en bloques de 5: primero las 5 presentaciones y luego las 5 preguntas, mezcladas. Orden dentro de la lección: saludos → conversación → lectura, con un kanji intercalado cada pocas palabras.
3. Cuando ya no quedan repasos ni nuevas: **práctica extra** en bloques de 10, empezando por las menos consolidadas. Acertar **no** cambia los intervalos (para no adelantar el SRS); fallar sí, con la regla normal.
4. Cada vez que se vacía la cola se repite el ciclo, así que entran los repasos que vayan venciendo. La sesión termina cuando el usuario pulsa «Terminar» y se muestra un resumen.

### Distractores (opción múltiple)
Se eligen tarjetas del mismo tipo, preferiblemente de lecciones cercanas y no posteriores a la selección. Verbos con verbos y expresiones con expresiones. Se excluyen las que comparten algún significado (comparando cada parte separada por «;» y sin paréntesis). **Truco para sinónimos:** dos palabras que no deben competir entre sí llevan el mismo texto principal en español y se distinguen con un paréntesis (ids 1319, 1715 y 1146: «Mucho gusto. (…)»).

## 5. Arquitectura

```
genki-app/
├── CLAUDE.md            contexto técnico (campos de datos, scripts, notas de la app)
├── DISENO.md            este documento
├── README.md            publicar en GitHub Pages e instalar en el iPhone
├── data/                vocabulary.json/.csv, kanji.json/.csv, es/ (traducciones), transcripción kanji Genki 1
├── scripts/             extracción desde los PDF + merge_es.py + build_app_data.py
└── docs/                la app (lo que publica GitHub Pages)
    ├── index.html, styles.css, app.js (≈730 líneas, sin dependencias)
    ├── data.js          generado: window.GENKI_DATA = { vocab, kanji }
    ├── sw.js            service worker (offline, stale-while-revalidate). ¡Subir VERSION al publicar!
    └── manifest.webmanifest, icons/
```

**Flujo de datos:** PDF → scripts de extracción → `data/*.json` → `merge_es.py` (añade el español) → `build_app_data.py` → `docs/data.js`.

**Estado en `localStorage`** (clave `genki-srs-v1`):
```
{ v, cards: { "v123": {s,due,reps,lapses,last}, "k45": {...} },
  settings: { furigana: auto|always|never, useful, autoplay, introSeen },
  study:    { type: vocab|kanji|mix, lessons: [n…] },
  day:      { key, newDone, reviewed, correct },
  streak:   { last, count } }
```
Ids de tarjeta: `v` + id de vocabulario, `k` + número de kanji (1–317).

**Pantallas:** Inicio (selector de tipo y lecciones, contadores, botón Estudiar, lección sugerida, progreso), Sesión (presentación / opción múltiple / inversa / recuerdo, resumen), Lecciones (lista con avance; detalle con listas y botones «Estudiar vocabulario / kanji»), Ajustes (furigana, expresiones útiles, audio automático, exportar/importar/borrar).

**Audio:** voz japonesa del sistema (`speechSynthesis`, `ja-JP`). No hay grabaciones.

## 6. Limitaciones conocidas

- **Ejemplos por OCR (Genki 1):** 729 palabras tienen una oración de ejemplo sacada por OCR. Algunas tienen errores (furigana mezclado) o son líneas de tabla. La fuente se muestra como «· OCR».
- **240 palabras sin oración** porque en el libro solo aparecen en listas. Hay 5 kanji sin oración.
- **Traducciones propias:** pueden tener imprecisiones; se corrigen en `data/es/`.
- **El progreso no se sincroniza** entre dispositivos; si se borran los datos de Safari, se pierde. Mitigación: Ajustes → Exportar.
- **Publicación:** con un repositorio público en Pages, el material extraído de Genki (con derechos de autor) quedaría visible para cualquiera.
- **Ejercicios:** el recuerdo activo es por autoevaluación; no se escribe la respuesta.
- **Sin pruebas automáticas.** Se ha probado a mano en el navegador integrado.
- La vibración al responder no funciona en iOS (Safari no la soporta); no causa errores.

## 7. Ideas y siguientes pasos (sin priorizar)

1. **Publicar y probar en el iPhone real** (resolver primero lo de Pages público o privado).
2. Escribir la lectura en kana como ejercicio (teclado japonés) para las etapas altas.
3. Revisar y corregir los ejemplos OCR; botón «reportar ejemplo malo» que marque la tarjeta.
4. Sincronización opcional (por ejemplo, exportar a iCloud Drive o un backend mínimo).
5. Estadísticas: pronóstico de repasos por día, precisión por lección, palabras más falladas («sanguijuelas»).
6. Tarjetas de lectura de kanji (kanji → on/kun) y orden de trazos.
7. Ajustes de intervalos o de tamaño de bloque; modo «solo repasos».
8. Pruebas automáticas mínimas del SRS (funciones puras de `gradeCard`/`refill`).

## 8. Cómo trabajar

- **Probar en local:** `python3 -m http.server 8765 --directory docs` y abrir `http://localhost:8765` (en el navegador integrado: config `genki-app` en `~/.claude/launch.json`).
- **Cambiar datos:** editar `data/es/*.tsv` → `python3 scripts/merge_es.py` → `python3 scripts/build_app_data.py`.
- **Publicar:** subir `VERSION` en `docs/sw.js` → `git commit` → `git push`. El token de GitHub del usuario está guardado en el llavero de macOS, así que el `git push` funciona sin pedir credenciales.
- Ver `window.__genki` en la consola del navegador para depurar (estado, sesión actual).
