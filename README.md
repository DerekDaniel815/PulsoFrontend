# PulsoFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.7.

## Última ubicación durante una emergencia

El mapa consulta `GET /locations/visible` y `GET /emergencies/active` al
iniciar sesión; al abrir `/mapa` vuelve a consultar ambas fuentes. Si una
emergencia activa autorizada incluye `ubicacion` pero el GPS ya no aparece en
las ubicaciones visibles, el mapa general muestra un marcador de emergencia
con la **última ubicación conocida** y la hora real de captura. No se presenta
como ubicación en vivo ni se guarda en el navegador. En una vista filtrada por
persona, el dispositivo solo se asocia a esa persona cuando
`/locations/visible` devuelve su asignación; el DTO de emergencia no incluye
el identificador del propietario. Sin una coordenada previa proporcionada por
el servidor, no se puede mostrar una posición al apagarse el GPS.

## Contrato pendiente: historial de GPS compartidos sin reportes recientes

La página `/historial` consulta los GPS propios con `GET /user-devices/me` y necesita
`GET /locations/history-sources` (autenticado) para los GPS de otras personas cuyo
historial **continúa autorizado**, incluso si dejaron de reportar ubicaciones.
Respuesta esperada:

```json
[
  {
    "idUsuarioDispositivo": 42,
    "idUsuario": 12,
    "alias": "GPS de Ana",
    "codigoDispositivo": "PUL-123"
  }
]
```

El backend debe devolver `[]` cuando no haya dispositivos compartidos autorizados;
no debe depender de `/locations/visible` ni de la vigencia de la última posición.
Al revocarse el permiso, debe retirar el GPS de esta lista y denegar
`GET /locations/user-device/{id}/history` (403), también para periodos anteriores.
Si el GPS simplemente deja de transmitir y el permiso sigue vigente, ambas
consultas deben seguir funcionando. El frontend cruza la lista con los contactos
que comparten su ubicación, actualiza los permisos ante notificaciones y borra
el historial seleccionado si se retira el acceso.

**Compatibilidad:** mientras el servidor responda 404 a `/locations/history-sources`,
el selector vuelve a usar los GPS de `/locations/visible`. En ese caso todavía no
se puede consultar el historial de un GPS compartido que haya desaparecido de
esa lista; otros errores no habilitan esa alternativa.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
