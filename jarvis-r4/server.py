"""JARVIS R4 Cloud: serves the original dashboard and receives JSON uploads."""
import hmac
import json
import os
import tempfile
from pathlib import Path
from flask import Flask, Response, abort, redirect, request, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge

ROOT = Path(__file__).resolve().parent
DASHBOARD = ROOT / 'AVL'
DATA_DIR = Path(os.environ.get('JARVIS_DATA_DIR', str(ROOT / 'data'))).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
TECHS = {'2G', '3G', '4G', '5G'}
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 24 * 1024 * 1024

@app.before_request
def protect():
    if request.path == '/health':
        return None
    username = os.environ.get('JARVIS_USER', '')
    password = os.environ.get('JARVIS_PASSWORD', '')
    if not username or not password:
        return Response('JARVIS_USER y JARVIS_PASSWORD deben configurarse', status=503)
    auth = request.authorization
    if not auth or not (hmac.compare_digest(auth.username or '', username) and hmac.compare_digest(auth.password or '', password)):
        return Response('Acceso restringido', 401, {'WWW-Authenticate': 'Basic realm="JARVIS R4"'})

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.get('/')
def home():
    return redirect('/AVL/index.html')

@app.get('/AVL/')
def dashboard_home():
    return redirect('/AVL/index.html')

@app.get('/AVL/index.html')
def dashboard():
    return send_from_directory(DASHBOARD, 'index.html')

@app.get('/AVL/data/<path:filename>')
def data(filename):
    if filename not in {f'disponibilidad_{t}_data.json' for t in TECHS} | {'disponibilidad_data.json'}:
        abort(404)
    return send_from_directory(DATA_DIR, filename, max_age=0)

@app.post('/upload')
def upload():
    technology = request.form.get('tecnologia', '').upper()
    if technology not in TECHS:
        return {'error': 'Tecnologia no permitida'}, 400
    f = request.files.get('file')
    if f is None:
        return {'error': 'Falta el archivo JSON'}, 400
    try:
        obj = json.load(f.stream)
    except (ValueError, UnicodeError):
        return {'error': 'JSON invalido'}, 400
    if not isinstance(obj, dict) or obj.get('tecnologia', '').upper() != technology:
        return {'error': 'Tecnologia del JSON no coincide'}, 400
    expected = ('historico_general', 'historico_zona', 'sitios_por_semana', 'semana_actual')
    if not all(k in obj for k in expected):
        return {'error': 'JSON incompleto'}, 400
    dest = DATA_DIR / f'disponibilidad_{technology}_data.json'
    tmp = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=DATA_DIR, prefix='.pending_', delete=False) as out:
            tmp = Path(out.name)
            json.dump(obj, out, ensure_ascii=False)
        os.replace(tmp, dest)
    finally:
        if tmp and tmp.exists():
            tmp.unlink()
    return f'JSON guardado correctamente para {technology}', 200

@app.errorhandler(RequestEntityTooLarge)
def too_large(_):
    return {'error': 'Archivo demasiado grande'}, 413

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '8001')))
