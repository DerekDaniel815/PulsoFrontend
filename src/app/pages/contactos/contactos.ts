import { Component } from '@angular/core';

@Component({
  selector: 'app-contactos',
  template: `
    <section class="page">
      <div class="page-head">
        <h1>Contactos</h1>
        <p>Solicitudes y contactos aceptados. Coincide con el módulo de contactos del backend.</p>
      </div>
      <article class="card empty-card">
        Lista de contactos, estados PENDIENTE / ACEPTADO y permisos de ubicación.
      </article>
    </section>
  `,
})
export class Contactos {}
