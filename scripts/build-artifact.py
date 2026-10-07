#!/usr/bin/env python3
"""Genera la versión Artifact (sin <html>/<head>/<body>) a partir de src/keeper-cup-3.html.
Uso: python3 scripts/build-artifact.py <salida.html>"""
import re, sys
src = open('src/keeper-cup-3.html', encoding='utf8').read()
title = re.search(r'<title>.*?</title>', src, re.S).group(0)
style = re.search(r'<style>.*?</style>', src, re.S).group(0)
body = re.search(r'<body>(.*)</body>', src, re.S).group(1)
open(sys.argv[1], 'w', encoding='utf8').write(title + '\n' + style + '\n' + body.strip() + '\n')
