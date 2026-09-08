import { Component } from '@angular/core';

@Component({
  selector: 'app-grupos',
  template: `
    <section class="page">
      <div class="page-head">
        <h1>Grupos</h1>
        <p>Grupos, miembros e invitaciones (ADMIN / MIEMBRO).</p>
      </div>
      <article class="card empty-card">
        Aquí irá el listado de grupos y las invitaciones pendientes.
      </article>
    </section>
  `,
})
export class Grupos {}
