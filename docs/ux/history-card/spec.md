# Tarjeta de histórico de riego — especificación

> Estado: **implementado** · Última actualización: 2026-10-03
> Componente: `<irrigation-history-card>` (`frontend/src/card/history-card.ts`).

## 1. Propósito

Permite consultar el tiempo real en que cada válvula física estuvo encendida (**tiempo real = hora real de apagado − hora real de encendido**), agrupado por zona, con origen del riego y marcas de incidencias o alertas.

## 2. Decisiones de arquitectura

1. **Fuente de datos:** El `recorder` de HA mediante WebSocket (`history/history_during_period` con `minimal_response: true`). Cubre todos los orígenes de encendido sin base de datos propia.
2. **Ventana temporal máxima:** 7 días (`MAX_WINDOW_DAYS`).
3. **Tres vistas conmutables mediante chips:**
   - **Lista:** Intervalos cronológicos detallados con horas y duración.
   - **Línea de tiempo:** Gráfico SVG de barras de actividad y marcas de alertas con tooltip emergente interactivo.
   - **Totales:** Resumen acumulado de tiempos y número de encendidos por válvula y por zona.
4. **Selector de ventana:**
   - Ventanas relativas: 6 h, 24 h, 3 d, 7 d y «Otra».
   - Modo «Rango»: Selección de fecha/hora de inicio y fin acotada a los últimos 7 días.

## 3. Origen del riego y marcas de alerta

### 3.1 Sensor «Modo riego» (backend)
Para registrar el origen exacto del riego en el historial de HA:
- Entidad `sensor.modo_riego_{nombre_disp}` por cada válvula configurada.
- Estados: `idle`, `scheduled` (programado), `manual` (botón/servicio de la integración), `external` (interruptor físico o automatización ajena).
- En la línea de tiempo, el popup muestra si el riego fue programado, manual o externo.

### 3.2 Marcas de alertas
- Las alertas e incidencias registradas en las entidades `event` (`event.alertas_riego_*`) se leen del recorder.
- Se muestran como marcas de color en la fila correspondiente (válvula, zona o instalación):
  - Rojo (`error`): fallos de encendido/apagado, falta de agua.
  - Amarillo (`warning`): excesos de tiempo, sensores caídos, datos de lluvia caídos.
  - Azul (`info`): riegos omitidos por lluvia.
- Al interactuar con la marca, un pop up propio muestra el tipo de alerta, severidad y hora exacta.

## 4. Configuración Lovelace

```yaml
type: custom:irrigation-history-card
title: Histórico de riego            # opcional
zones: [zona_a, zona_b]              # opcional (vacío = todas las zonas)
view: list                           # list | timeline | totals (por defecto list)
window: { amount: 24, unit: hours }  # ventana inicial (por defecto 24 h)
```

## 5. Integración en el panel

En el panel lateral de Riego (pestaña Zonas), la tarjeta de histórico se renderiza debajo de la tarjeta principal `<irrigation-scheduler-card>`, compartiendo la misma suscripción de snapshot y refrescándose automáticamente.
