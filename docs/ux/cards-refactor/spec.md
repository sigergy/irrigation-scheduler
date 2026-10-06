# Vista Zonas del panel con las tarjetas Lovelace — diseño

Fecha: 2026-10-03.

Mockup: [`docs/ux/cards-refactor/mockup.html`](mockup.html).

## Problema

La pestaña Zonas del panel lateral pinta `<irrigation-zone-list>` (`frontend/src/panel/irrigation-panel.ts:125-131`),
una lista propia (`frontend/src/panel/zone-list.ts`). Repite casi todo lo que ya hace la tarjeta de resumen
(`frontend/src/card/irrigation-card.ts`): icono y estado de zona, botones ▶ ■, válvulas desplegables. Son dos vistas
de lo mismo que divergen:

- la lista muestra el chip de estado (`zoneBadge`, `shared/zone-status.ts:53`), el resumen de días y horas
  (`zoneSummary`, `shared/zone-status.ts:58`) y una columna de próximo riego (`zone-list.ts:62-83`);
- la tarjeta escribe el estado como texto, «Programada · Mañana 09:45» (`zoneLine`, `irrigation-card.ts:201-225`),
  y abre el editor en un diálogo (`irrigation-card.ts:101-126`);
- la lista abre el editor a página completa (`irrigation-panel.ts:60-73`).

El panel tampoco muestra el histórico; solo existe como tarjeta Lovelace (`frontend/src/card/history-card.ts`).

## Objetivo

- La vista Zonas del panel es la tarjeta de resumen seguida de la tarjeta de históricos, en ese orden.
- Una sola implementación de la fila de zona y del acceso al editor: la de la tarjeta.
- La tarjeta hereda de la lista del panel el chip de estado y la fila completa.
- El diálogo del editor muestra el chip de estado y los botones «Regar zona» / «Detener zona».
- Las dos tarjetas son responsive según el ancho de la propia tarjeta, no el de la pantalla.

## Decisiones

1. **El editor se abre siempre en el diálogo de la tarjeta**, también en el panel. Desaparece el editor a página
   completa del panel. En móvil el diálogo ya ocupa toda la pantalla (`irrigation-card.ts:313-318`).
2. **Fila completa del panel en la tarjeta** (opción A elegida por el usuario):
   - botón de desplegar e icono de la zona;
   - nombre y, debajo, `zoneSummary` («Todos los días · 09:45, 18:00 · 4 válvulas»);
   - columna de estado: `zoneBadge` y, debajo, la línea secundaria que hoy pinta la lista
     (`zone-list.ts:73-80`): «Lote · 12:30», nombre de la válvula activa, o el texto de retenida (`heldText`);
   - próximo riego (`formatNextRun`);
   - botones ▶ ■ y, al final, el engranaje.
3. **El engranaje no se mueve**: extremo derecho, dentro del grupo de botones, tras ▶ ■, como hoy
   (`irrigation-card.ts:180-195`). La flecha «›» de la lista del panel (`zone-list.ts:84`) no se traslada.
4. **Pulsar la fila despliega las válvulas**, como hoy en la tarjeta (`irrigation-card.ts:162`). Solo el engranaje
   abre el editor.
5. **La barra de progreso del lote se mantiene** bajo el nombre cuando la zona tiene más de una válvula
   (`irrigation-card.ts:177-178`).
6. **El cambio aplica también a la tarjeta en Lovelace.** No hay modo panel: es el mismo elemento.

## Diseño

### Panel (`frontend/src/panel/irrigation-panel.ts`)

- `renderBody()` pinta, en la pestaña Zonas:
  1. `<irrigation-scheduler-card>` configurada con `{ type: "custom:irrigation-scheduler-card", zones: [] }`;
  2. `<irrigation-history-card>` configurada con `{ type: "custom:irrigation-history-card", zones: [] }`.

  `zones: []` significa todas las zonas (`shared/card-config.ts:21-23`). La configuración se pasa con `setConfig()`
  una vez por elemento (no en cada render), porque `setConfig` reinicia vista y ventana del histórico
  (`history-card.ts:100-104`).
- Se mantienen la barra (pestañas y «Pausar todo», `irrigation-panel.ts:78-107`) y los banners de no cargada, error,
  cargando y sin conexión (`irrigation-panel.ts:111-115`).
- Se eliminan el estado `_zoneId`, la rama del editor a página completa (`irrigation-panel.ts:60-73`), el
  `this._zoneId = undefined` de `selectTab` y los imports de `./zone-list` y `./zone-editor`.
- Separación vertical entre las dos tarjetas: 16px (8px en móvil, igual que `.content`).
- El panel ya no necesita su `SnapshotController` para la pestaña Zonas, pero lo sigue usando para «Pausar todo», los
  banners y Ajustes. Las tarjetas comparten la misma suscripción WS por conexión (`store.ts:24,50`).

### Borrado de `frontend/src/panel/zone-list.ts`

El fichero entero se elimina. Su CSS de fila (rejilla móvil, `.status`, `.next`, `.buttons`, `button.expand`,
`zone-list.ts:117-228`) pasa a la tarjeta. El botón flotante «Añadir zona» (`zone-list.ts:41`) desaparece; lo
sustituye «+ Zona», al pie de la tarjeta (`irrigation-card.ts:145-149`).

[`docs/ux/spec.md`](../spec.md):51 cita `zone-list.ts`; se actualiza la entrada.

### Tarjeta de resumen (`frontend/src/card/irrigation-card.ts`)

**Fila** (`renderZone`):

```
[⌄] [icono]  Nombre                        [chip estado]   próximo   [▶] [■] [⚙]
             Todos los días · 09:45 · 4 v.  línea secundaria
             ▬▬▬▬▬▬▬ (barra de lote)
```

- Se elimina `zoneLine()`: el chip y la línea secundaria cubren sus casos (`running` con lote o válvula manual,
  `queued` con retenida, `idle`, `stopped`).
- La línea secundaria se calcula como en `zone-list.ts:47-50,73-80`; si al implementarlo la lógica queda idéntica,
  se extrae a una función en `shared/zone-status.ts` (aunque ya solo haya un consumidor, si simplifica `renderZone`;
  si no, se queda en la tarjeta).

**Responsive por contenedor:**

- `.card-content` (o `ha-card`) lleva `container-type: inline-size`.
- `@container (max-width: 600px)`: la fila pasa a la rejilla de dos líneas de la lista del panel
  (`zone-list.ts:174-221`):

  ```
  "expand icon main status"
  "expand icon next buttons"
  ```

  Sin columna `chevron`: el engranaje va dentro de `buttons`.
- En anchos muy estrechos (`@container (max-width: 360px)`), la línea secundaria de estado y el resumen pueden
  truncarse con `text-overflow: ellipsis`; los botones no encogen (`flex: none`, como hoy en
  `irrigation-card.ts:269`).
- Las válvulas desplegadas mantienen su sangría bajo el icono de zona; en el modo estrecho se reduce como en
  `zone-list.ts:197-199`.

**Diálogo del editor** (`renderEditor`, `irrigation-card.ts:101-126`):

- Se quita `hide-controls`: la barra del editor muestra el chip de estado y «Regar zona» / «Detener zona»
  (`zone-editor.ts:456-460`).
- «Cancelar» depende hoy de `hideControls` (`zone-editor.ts:474-476`). Pasa a depender de un atributo propio,
  `in-dialog` (propiedad `inDialog`), que la tarjeta pone. Sin él, el diálogo solo se cierra con ← o Esc.
- **«Borrar zona» va a la derecha, pegado a la izquierda de «Cancelar»**: orden de la barra
  `← nombre · chip · Regar · Detener · [espacio] · Borrar zona · Cancelar · Guardar`.
- **Modal de confirmación único** para «Borrar zona», «Cancelar» y «Guardar»: mensaje genérico «¿Seguro que quieres
  continuar?», botones «Volver» y «Continuar». Sustituye a los textos propios de borrar y de salir sin guardar
  (`confirm_delete`, `confirm_leave`, `zone-editor.ts:364-375,416-426`). Se pide siempre, haya o no cambios.
  `←` y Esc (`back()`) usan el mismo modal, pero solo si hay cambios sin guardar. Los avisos de error del borrado
  (`delete_valves_not_off`, `delete_zone_busy`) y la confirmación de quitar válvula no cambian.
- `hideControls` se elimina de `zone-editor.ts` (`:85`, `:100`, `:124`, `:456`, `:474`) y de cualquier CSS que use
  `[hide-controls]`, si no queda otro consumidor (comprobar con `graft callers`).

### Tarjeta de históricos (`frontend/src/card/history-card.ts`)

Sin cambios de comportamiento. Se revisa dentro del panel (ancho máximo 1200px, `irrigation-panel.ts:166`) y en
móvil. Si el eje, los chips de vista y ventana o las etiquetas de válvula desbordan, se corrigen con el mismo
criterio `@container`. Su ancho de eje ya se mide con `ResizeObserver` (`history-card.ts:72-74`).

## Fuera de alcance

- Cambiar el editor de zona más allá de su barra y de la confirmación de sus acciones.
- Configurar desde el panel qué zonas, vista o ventana muestran las tarjetas.
- Nuevas acciones en la tarjeta.

## Verificación

Según la memoria del proyecto, las features de frontend no llevan tests. Gates estáticos en `frontend/`:

- `npm run lint`
- `npx tsc --noEmit` (no hay script de typecheck en `frontend/package.json`)
- `npm run build` (`vite build`), que regenera `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`

La comprobación visual (panel, Lovelace, móvil y escritorio) se hace en la VM.
