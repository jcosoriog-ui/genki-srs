# Genki SRS

App web (PWA) para estudiar el vocabulario y los kanji de **Genki I y II** con repetición espaciada. Funciona sin conexión y se instala en el iPhone desde Safari.

## Publicar en GitHub Pages (una sola vez)

1. Crea un repositorio vacío en https://github.com/new (por ejemplo `genki-srs`). Sin README.
2. En la terminal, desde esta carpeta:
   ```bash
   git init -b main
   git add .
   git commit -m "Genki SRS"
   git remote add origin https://github.com/TU_USUARIO/genki-srs.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / carpeta `/docs` → Save**.
4. En un minuto la app estará en `https://TU_USUARIO.github.io/genki-srs/`.

## Instalar en el iPhone

Abre la URL en **Safari** → botón **Compartir** → **Añadir a pantalla de inicio**. Ábrela siempre desde ese icono: así funciona sin conexión y conserva tu progreso.

## Actualizar

Cambia lo que necesites, sube `VERSION` en `docs/sw.js`, y haz `git commit` + `git push`. El iPhone recibe la versión nueva al abrir la app con conexión (a veces hace falta abrirla dos veces).

El progreso vive solo en el teléfono: usa **Ajustes → Exportar** de vez en cuando como copia de seguridad.
