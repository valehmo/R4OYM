# JARVIS R4 Cloud — despliegue inicial

Dashboard multitecnología (2G/3G/4G/5G/Global) basado en el HTML proporcionado. Conserva el procesamiento Excel en el navegador y la subida de JSON por `/upload`.

## Seguridad
- Repositorio **privado**. No subir históricos, credenciales, hojas Excel ni información operativa.
- Acceso mediante autenticación HTTP Basic sobre HTTPS. Es un control inicial; para producción corporativa se recomienda SSO/VPN, auditoría y restricciones de red.
- `/health` es público y solo devuelve el estado.

## Render
1. Conectar el repositorio GitHub a Render y crear un **Blueprint** desde `render.yaml`.
2. Configurar `JARVIS_USER` y `JARVIS_PASSWORD` como secretos en Render.
3. El Blueprint solicita un servicio **Starter con disco persistente**; puede generar cargos. Verificar precios antes de crear.
4. Visitar `https://<nombre>.onrender.com/AVL/index.html`.
5. Cargar un Excel de prueba autorizado. El navegador genera JSON y lo envía al disco persistente `/var/data`.

**Nota:** no se incluyen históricos reales ni los scripts Ericsson/SSH; solo se migra el dashboard AVL y su endpoint de carga. Los archivos `legacy/app.js` y `legacy/styles.css` son de otra interfaz y se conservan para futura integración, pero no se activan.

## Prueba local
```
python -m pip install -r requirements.txt
set JARVIS_USER=admin
set JARVIS_PASSWORD=CAMBIAR_ESTA_CLAVE
python server.py
```
Abrir `http://127.0.0.1:8001/AVL/index.html`.

## Limitaciones
- El dashboard usa SheetJS desde CDN, por lo que requiere acceso a ese recurso.
- HTTP Basic no ofrece gestión de usuarios, roles ni cierre de sesión. Requiere HTTPS.
- Los JSON históricos deben migrarse por un canal autorizado y seguro, no mediante commits al repositorio.
- El volumen persistente requiere respaldos externos periódicos.
