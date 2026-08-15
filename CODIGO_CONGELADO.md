# Código congelado — Academic OS

La **aplicación sigue igual por dentro** (todas las opciones visibles). Lo que se congela es **editar el código** desde Cursor, PowerShell, etc.

## Bloquear edición (recomendado ahora)

Doble clic en la raíz del repo:

```
BLOQUEAR_CODIGO.bat
```

Esto hace:

1. Crea/mantiene el marcador `CODEBASE.FROZEN` (avisa a Cursor Agent).
2. Marca archivos de código como **solo lectura** en Windows (`attrib +R`).

No podrás guardar cambios en `academic-os/src`, configs, etc. La app compilada (`dist/`, `INICIAR.bat`) sigue funcionando.

## Desbloquear para volver a programar

```
DESBLOQUEAR_CODIGO.bat
```

Quita solo lectura y borra `CODEBASE.FROZEN`.

## Qué sigue editable con bloqueo

- Datos del navegador (IndexedDB) — tu progreso de estudio
- Ejecutar `INICIAR.bat` / usar la PWA
- Exportar backup desde la app (💾)

## Qué NO podrás hacer con bloqueo

- Guardar archivos `.ts`, `.tsx`, `.css` en el proyecto
- Que Cursor Agent modifique el código (regla en `.cursor/rules/codebase-frozen.mdc`)
- `npm run build` fallará al escribir en `dist/` si también bloqueaste salida — el script bloquea solo código fuente, no `dist/`

## Nota

El bloqueo de Windows es local en tu PC. Si necesitas aislamiento total, no abras el repo en Cursor hasta desbloquear.
