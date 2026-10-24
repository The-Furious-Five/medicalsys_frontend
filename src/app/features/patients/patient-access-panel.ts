import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { API_BASE_URL } from '../../core/config/api-url';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { describeFailure } from '../../core/http/api-error';
import { dataResource } from '../../core/http/data-resource';
import { Tone } from '../../core/state/state-machines';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Notice } from '../../shared/notice';
import { StatusChip } from '../../shared/status-chip';

/** `PatientAccessGrantResponse` de ms-pacientes. */
interface AccessGrant {
  readonly grantId: string;
  readonly requestingOrganizationId: string;
  readonly status: 'REQUESTED' | 'AUTHORIZED' | 'REVOKED' | 'EXPIRED';
  readonly requestedAt: string;
  readonly authorizedAt: string | null;
  readonly revokedAt: string | null;
}

const GRANT_STATUS: Record<string, string> = {
  REQUESTED: 'Esperando al paciente',
  AUTHORIZED: 'Autorizado',
  REVOKED: 'Revocado',
  EXPIRED: 'Vencido',
};
const GRANT_TONES: Record<string, Tone> = {
  REQUESTED: 'warn',
  AUTHORIZED: 'ok',
  REVOKED: 'muted',
  EXPIRED: 'muted',
};

/**
 * DAC (ISO-01): quién más ve a este paciente lo decide él, no el centro.
 *
 * Otra organización pide acceso; al paciente le llega un código por WhatsApp
 * y, si está de acuerdo, se lo dicta a quien lo atiende, que lo registra aquí.
 * Nadie puede autorizarse a sí mismo: sin el código, la solicitud no pasa de
 * «Esperando al paciente». El servicio filtra la lista a lo que la
 * organización de la sesión puede ver.
 */
@Component({
  selector: 'medsys-patient-access-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, Notice, StatusChip, ...FORMAT_PIPES],
  template: `
    <section class="section">
      <div class="card">
        <div class="card-head">
          <div class="row gap-2">
            <medsys-icon name="shield-check" [size]="15" class="icon-muted" />
            <h2 class="t-section">Accesos concedidos por el paciente</h2>
          </div>
          @if (canRequest()) {
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              [disabled]="pending()"
              (click)="request()"
            >
              <medsys-icon name="message-plus" [size]="14" /> Pedir acceso
            </button>
          }
        </div>
        <div class="card-body stack gap-3">
          <p class="t-sec t-measure">
            El paciente es dueño de sus datos: solo una organización a la que él autoriza con el
            código de WhatsApp ve su ficha y su historial.
          </p>
          @if (failure(); as message) {
            <medsys-notice tone="err">{{ message }}</medsys-notice>
          }
          @for (grant of grants.value() ?? []; track grant.grantId) {
            <div class="row gap-3 wrap">
              <div class="pair grow">
                <span class="t-mono t-micro">{{ grant.requestingOrganizationId }}</span>
                <span class="t-micro">Pedido el {{ grant.requestedAt | msDateTime }}</span>
              </div>
              <medsys-status-chip [value]="grant.status" [dictionary]="statuses" [tones]="tones" />
              @if (grant.status === 'REQUESTED' && canConfirm()) {
                <input
                  class="input"
                  style="width: 9rem"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="8"
                  placeholder="Código"
                  [attr.aria-label]="'Código que dicta el paciente'"
                  [(ngModel)]="codes[grant.grantId]"
                />
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="pending() || !codes[grant.grantId]"
                  (click)="confirm(grant)"
                >
                  Confirmar
                </button>
              }
              @if (grant.status === 'AUTHORIZED' && canRevoke()) {
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  [disabled]="pending()"
                  (click)="revoke(grant)"
                >
                  Revocar
                </button>
              }
            </div>
          } @empty {
            <p class="t-sec">Ninguna otra organización pidió acceso.</p>
          }
        </div>
      </div>
    </section>
  `,
})
export class PatientAccessPanel {
  readonly patientId = input.required<string>();

  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);

  protected readonly statuses = GRANT_STATUS;
  protected readonly tones = GRANT_TONES;
  protected readonly codes: Record<string, string> = {};

  protected readonly canRequest = computed(() =>
    can.requestAccessGrant(this.session.permissions()),
  );
  protected readonly canConfirm = computed(() =>
    can.confirmAccessGrant(this.session.permissions()),
  );
  protected readonly canRevoke = computed(() => can.revokeAccessGrant(this.session.permissions()));

  protected readonly grants = dataResource(
    httpResource<readonly AccessGrant[]>(() => this.path(), { defaultValue: [] }),
  );
  protected readonly pending = signal(false);
  protected readonly failure = signal<string | null>(null);

  private path(): string {
    return `${this.baseUrl}/patients/${encodeURIComponent(this.patientId())}/acceso/solicitudes`;
  }

  protected request(): Promise<void> {
    return this.run(
      this.http.post<AccessGrant>(this.path(), {}),
      'Se envió el código al WhatsApp del paciente.',
    );
  }

  protected confirm(grant: AccessGrant): Promise<void> {
    return this.run(
      this.http.post<AccessGrant>(`${this.path()}/${grant.grantId}/confirmacion`, {
        otpCode: this.codes[grant.grantId]?.trim(),
      }),
      'El paciente autorizó el acceso.',
    );
  }

  protected revoke(grant: AccessGrant): Promise<void> {
    return this.run(
      this.http.post<AccessGrant>(`${this.path()}/${grant.grantId}/revocacion`, {}),
      'Acceso revocado.',
    );
  }

  private async run(call: ReturnType<HttpClient['post']>, done: string): Promise<void> {
    this.pending.set(true);
    this.failure.set(null);
    try {
      await firstValueFrom(call);
      this.toasts.notify(done);
      this.grants.reload();
    } catch (failure) {
      this.failure.set(describeFailure(failure).message);
    } finally {
      this.pending.set(false);
    }
  }
}
