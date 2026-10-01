# 🚀 Deployment: Railway + Vercel

## Paso 1: Crear Base de Datos en Railway (5 minutos)

### 1.1 Crear cuenta en Railway
1. Ve a **https://railway.app**
2. Click en "Sign up with GitHub"
3. Autoriza con tu cuenta de GitHub

### 1.2 Crear nuevo proyecto
1. Click en **+ New Project**
2. Selecciona **Database** → **PostgreSQL**
3. Espera a que se cree (1-2 min)

### 1.3 Obtener credenciales
1. En el proyecto, ve a la pestaña **Connect**
2. Copia la variable `DATABASE_URL`
3. Debe verse así: `postgresql://user:pass@host:5432/keeper`

### 1.4 Variables de entorno en Railway
1. Vuelve al proyecto
2. Pestaña **Variables**
3. Agrega:
   ```
   DATABASE_URL=postgresql://...
   GOOGLE_SHEETS_ID=1O1JZQWsUkVu7FxffB3craCbAGHBjIaUrh9C5XHCC6Yw
   ADMIN_EMAIL=ainteligencia075@gmail.com
   ```

---

## Paso 2: Preparar el código para Vercel

### 2.1 Crear archivo `prisma/.env.local`
```bash
# En la raíz del proyecto, crea un archivo .env.local
DATABASE_URL="postgresql://..."  # La que copiaste de Railway
```

### 2.2 Generar cliente de Prisma
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
```

---

## Paso 3: Deployar a Vercel (2 minutos)

### 3.1 Push a GitHub
```bash
git add .
git commit -m "Add database schema and team registration API"
git push origin claude/quirky-ramanujan-lcfqj5
```

### 3.2 Deploy en Vercel
1. Ve a **https://vercel.com/new**
2. Selecciona el repo `dmaflaf/appskc3`
3. En "Environment Variables" agrega:
   ```
   DATABASE_URL=postgresql://...
   GOOGLE_SHEETS_ID=1O1JZQWsUkVu7FxffB3craCbAGHBjIaUrh9C5XHCC6Yw
   ADMIN_EMAIL=ainteligencia075@gmail.com
   ```
4. Click en **Deploy**

### 3.3 Esperar deployment
- Vercel compila el proyecto
- En 2-3 minutos tendrás URL tipo: `appskc3.vercel.app`

---

## Paso 4: Conectar keeper.com.ec a Vercel

### 4.1 En tu registrador de dominio (GoDaddy, Namecheap, etc)
1. Panel de DNS → Records
2. Agrega estos registros CNAME:
   ```
   www    CNAME   cname.vercel-dns.com
   @      CNAME   cname.vercel-dns.com
   ```

### 4.2 En Vercel
1. Abre tu proyecto
2. Settings → Domains
3. Click **Add Domain**
4. Ingresa: `keeper.com.ec`
5. Vercel detecta automáticamente tus DNS
6. ¡Listo! En 5-10 minutos estará activo

---

## Verificar que todo funciona

```bash
# Check DNS
nslookup keeper.com.ec

# Debe devolver algo como:
# keeper.com.ec has CNAME cname.vercel-dns.com
```

Luego abre en tu navegador:
- `https://keeper.com.ec` → Dashboard
- `https://keeper.com.ec/registro` → Formulario de registro
- `https://keeper.com.ec/carnets` → Generador de carnets

---

## Troubleshooting

### "DATABASE_URL no está disponible"
- Verifica que copiaste correctamente en Vercel → Environment Variables
- Redeploy el proyecto después de agregar variables

### "Error de migración de BD"
- En la consola de Vercel, ejecuta:
  ```bash
  npx prisma migrate deploy
  ```

### DNS no propaga
- Puede tomar 15-30 minutos
- Espera y prueba con `nslookup`

---

## Próximos pasos

- [ ] Migrar datos históricos de Google Sheets a PostgreSQL
- [ ] Sistema de fixture en vivo
- [ ] Dashboard de admin
- [ ] Tabla de posiciones en tiempo real
