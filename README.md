# Resguarda: simulador de planificación

Práctica 2da Eva. Parcial de ISO939, Integración de Aplicaciones. Simula el caso académico «Resguarda: producir al ritmo de la demanda», de Félix J. Rodriguez P., UNAPEC. La empresa HCC y las cifras son ficticias.

[Abrir el simulador](https://justsidus.github.io/resguarda-iso939/)

## Uso

1. Comenzar con la estrategia F y el escenario Base.
2. En Planta, recorrer las semanas y revisar capacidad, demanda y cuellos de botella. Los detalles se abren en Cálculos y recursos.
3. En Producción, revisar las 52 semanas, el inventario y los pedidos pendientes. La tabla semanal se abre a petición.
4. En Estrategias, comparar seis políticas en tres escenarios, con valor esperado y peor caso.
5. En Sensibilidad, cambiar un supuesto a la vez para ver cuánto afecta el resultado.
6. Para probar otro plan, pulsar Ajustar plan, cambiar los valores y pulsar Calcular plan. Cerrar conserva el borrador; un cálculo válido cierra los ajustes y muestra los resultados. El CSV contiene los tres escenarios del plan calculado.

## Tecnología

HTML, CSS y JavaScript, sin dependencias de ejecución. Todo el cálculo ocurre en el navegador. Node.js se usa únicamente para construir, servir la vista previa y ejecutar pruebas. GitHub Pages sirve el HTML estático ya construido desde `docs/`.

Con Node.js 20 o posterior, desde la raíz:

```sh
node --test tests/model.test.mjs
node build.mjs
node preview.mjs
```

Abrir `http://127.0.0.1:43139/`. El build produce `dist/index.html`, que también funciona como archivo autocontenido sin conexión. No hace falta instalar paquetes.

## Código

- `src/data.js`: datos del caso, escenarios, políticas y supuestos.
- `src/model.js`: capacidad, personal, aprendizaje, calidad, existencias, pendientes y flujo de caja.
- `src/app.js`: controles, cuatro vistas, validación y CSV.
- `src/styles.css`: presentación adaptable a móvil y escritorio.
- `build.mjs`: reúne los archivos en un solo HTML.
- `tests/model.test.mjs`: 15 pruebas, incluidos los 17 valores de control del caso.
- `analysis.mjs`: recalcula las seis políticas y guarda resultados en `qa/results.json`.

Para actualizar Pages, ejecutar el build, copiar `dist/index.html` a `docs/index.html` y publicar ese cambio en `main`. Los PDF personalizados no se alojan en este repositorio.

## Modelo y alcance

Modelo semanal determinista de valores esperados, de octubre de 2026 a octubre de 2027. No es una simulación de eventos discretos ni una optimización exhaustiva. Distingue datos del caso y supuestos adicionales; los supuestos y la tabla de validación se pueden consultar en el tablero.

La política F reequilibra las dos líneas con ocho personas, incorpora turnos por etapas y revisa la demanda observada desde S13. Su inversión es USD 18.000. Con probabilidades de 50%, 25% y 25%, el VPN esperado es aproximadamente USD 3.369.328. Es la mejor de las seis políticas evaluadas con estos supuestos.

Fuente: [caso del docente en Canvas](https://canvas.unapec.edu.do/courses/36755/files/11584186?wrap=1), anexos 1 a 11 y guía del tablero. El documento completo requiere acceso institucional y no se redistribuye aquí.

Se utilizó ChatGPT para programar el simulador, comprobar fórmulas y revisar la redacción. Los datos proceden del caso docente.
