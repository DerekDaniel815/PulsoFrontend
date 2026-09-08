import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DASHBOARD_ACTIVITY, DASHBOARD_CONTACTS } from './dashboard.data';
import { LiveMap } from '../../shared/live-map/live-map';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, LiveMap],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly contacts = DASHBOARD_CONTACTS;
  protected readonly activity = DASHBOARD_ACTIVITY;
}
