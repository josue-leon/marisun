# Ruleta de sorteo · Banco VisionFund Ecuador

Ruleta en HTML/CSS/JS puro (sin dependencias) para la Gran Rifa Navideña.

## Uso

Abre `index.html` en el navegador (doble clic) o sírvelo con cualquier servidor estático.

- **Girar:** clic en el logo / la ruleta, o tecla `Espacio`.
- Al frenar, la ruleta hace zoom y aparece una **lupa sobre la punta del selector** con los números ampliados.
- **Suspenso final:** viñeta oscura, halo animado, redoble de tambor que se acelera y efecto "casi": la ruleta se pasa un poco y regresa al ganador.
- **Revelación:** el número aparece dígito a dígito, con rayos de luz, destello, fanfarria y confeti de marca.
- ✏️ **Boletos:** genera un rango (por defecto 1–400) o pega uno por línea (`351` o `351 - Juan Pérez`).
- 🏆 **Ganadores:** historial con fecha y hora.
- ↺ **Reiniciar:** devuelve todos los boletos a la ruleta (el historial se conserva).
- El ganador se quita de la ruleta automáticamente (configurable).

El ganador se elige con `crypto.getRandomValues` (sin sesgo). La configuración se guarda en el navegador (`localStorage`).
