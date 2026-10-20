# Keeper Cup 3

Una sola herramienta (`index.html`, publicada con GitHub Pages): horarios por estadio, fixture con resultados, historial por equipo, balance de estadios y horarios, y posiciones.

## Nube

Toca la etiqueta de la parte superior de la página para conectar un token de GitHub con permiso `gist` (una vez por dispositivo, o pega el código KC3 copiado desde otro dispositivo). Los datos viven en un gist secreto de tu cuenta, se sincronizan solos y se abren iguales en cualquier dispositivo. Gana el cambio más reciente de cada partido. Sin token, la página guarda solo en el dispositivo.

## Exportar todos los datos

En Posiciones y en Fixture, el botón «📦 Descargar todos los datos» genera un ZIP con `datos.json` (todo en un solo archivo, formato `keeper-cup-3/export` v1), 7 CSV (equipos, partidos, posiciones, tarjetas, sanciones, valores por club, pagos) y un `LEEME.txt` con las claves, reglas e instrucciones para importarlos en otro sistema.
