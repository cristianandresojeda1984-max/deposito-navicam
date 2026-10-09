# Arma index.html a partir de app/ (python3 build.py)
import pathlib, datetime
r = pathlib.Path(__file__).parent; s = r / 'app'
h = (s / 'app.html').read_text()
js = '\n'.join((s / f).read_text() for f in sorted(p.name for p in s.glob('[0-9]*.js')))
v = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).strftime('%Y-%m-%d %H:%M')
h = h.replace('/*CSS*/', (s / 'app.css').read_text()).replace('/*JS*/', js).replace('/*VERSION*/', v)
(r / 'index.html').write_text(h)
print('index.html', len(h), v)
