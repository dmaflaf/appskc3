# 🚀 Deployment en Vercel + keeper.com.ec

## Paso 1: Deploy automático en Vercel (2 minutos)

1. Ve a **https://vercel.com/new**
2. Conecta tu cuenta de GitHub
3. Selecciona el repositorio `dmaflaf/appskc3`
4. Click en **Deploy**
5. ¡Listo! Tendrás una URL temporal tipo `appskc3.vercel.app`

## Paso 2: Conectar keeper.com.ec (5 minutos)

### A. Si tienes el dominio registrado en un registrar (GoDaddy, Namecheap, etc):

1. Ve a tu panel de registrador del dominio
2. Busca la sección **DNS Records** o **DNS Settings**
3. Añade estos registros:
   ```
   CNAME: www -> cname.vercel-dns.com
   CNAME: @ -> cname.vercel-dns.com
   ```

### B. En Vercel:

1. Ve al proyecto en Vercel
2. Settings → Domains
3. Click en **Add Domain**
4. Ingresa: `keeper.com.ec`
5. Vercel detectará automáticamente tus registros DNS
6. ¡Listo en 5-10 minutos!

## Verificar que funciona

```bash
curl -I https://keeper.com.ec
# Debe devolver status 200
```

## Desarrollo local

```bash
npm run dev
# Abre http://localhost:3000
```

## Próximos pasos

- [ ] Integrar base de datos (PostgreSQL)
- [ ] Sistema de fixture en vivo
- [ ] Autenticación de usuarios
- [ ] Dashboard de admin
