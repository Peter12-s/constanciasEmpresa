# DoGroup Constancias - Sistema de Gestión de Constancias

Aplicación web para la gestión y generación de constancias de capacitación empresarial desarrollada con React + TypeScript + Vite.

## Características

- Gestión de usuarios y empresas
- Generación de constancias en PDF
- Validación de constancias mediante QR
- Exportación a Excel
- Interfaz moderna con Mantine UI

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Compilar para producción
npm run build

# Vista previa de la compilación
npm preview
```

## Despliegue a GitHub Pages

Este proyecto está configurado para desplegarse en GitHub Pages. El archivo `.nojekyll` en la carpeta `public/` es **crucial** para el correcto funcionamiento del sitio.

### ¿Por qué es necesario el archivo .nojekyll?

GitHub Pages usa Jekyll por defecto, lo que puede causar problemas con aplicaciones modernas de JavaScript:
- Jekyll ignora archivos y carpetas que comienzan con guión bajo (`_`)
- Puede servir archivos JavaScript/TypeScript con MIME types incorrectos
- Esto resulta en el error: "Expected a JavaScript module script but the server responded with a MIME type of 'application/octet-stream'"

El archivo `.nojekyll` le indica a GitHub Pages que no use Jekyll, asegurando que todos los archivos se sirvan correctamente.

### Comandos de despliegue

```bash
# Compilar y desplegar
npm run predeploy  # Compila el proyecto
npm run deploy     # Despliega a gh-pages
```

## Tecnologías

- **React 19** - Biblioteca UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **Mantine UI** - Biblioteca de componentes
- **React Router** - Enrutamiento
- **pdfmake** - Generación de PDFs
- **xlsx** - Exportación a Excel
- **QRCode** - Generación de códigos QR

## Configuración de ESLint

Si estás desarrollando una aplicación de producción, recomendamos actualizar la configuración para habilitar reglas de lint con conocimiento de tipos:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

También puedes instalar [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) y [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) para reglas específicas de React:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
