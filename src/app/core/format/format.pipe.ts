import { Pipe, PipeTransform } from '@angular/core';
import {
  formatAge,
  formatBob,
  formatBytes,
  formatDate,
  formatDateTime,
  formatDocument,
  formatNumber,
  formatRelative,
  formatTime,
} from './format';

/* Las plantillas formatean a través de estos pipes para que ningún componente
   reimplemente el formato de una fecha o de un importe por su cuenta. */

@Pipe({ name: 'msDate' })
export class DatePipe implements PipeTransform {
  transform = (value?: string | null): string => formatDate(value);
}

@Pipe({ name: 'msTime' })
export class TimePipe implements PipeTransform {
  transform = (value?: string | null): string => formatTime(value);
}

@Pipe({ name: 'msDateTime' })
export class DateTimePipe implements PipeTransform {
  transform = (value?: string | null): string => formatDateTime(value);
}

@Pipe({ name: 'msRelative' })
export class RelativePipe implements PipeTransform {
  transform = (value?: string | null): string => formatRelative(value);
}

@Pipe({ name: 'msBob' })
export class BobPipe implements PipeTransform {
  transform = (value?: number | string | null): string => formatBob(value);
}

@Pipe({ name: 'msNumber' })
export class NumberPipe implements PipeTransform {
  transform = (value?: number | string | null, decimals = 0): string =>
    formatNumber(value, decimals);
}

@Pipe({ name: 'msBytes' })
export class BytesPipe implements PipeTransform {
  transform = (value?: number | null): string => formatBytes(value);
}

@Pipe({ name: 'msDocument' })
export class DocumentPipe implements PipeTransform {
  transform = (value?: string | null, complement?: string | null): string =>
    formatDocument(value, complement);
}

@Pipe({ name: 'msAge' })
export class AgePipe implements PipeTransform {
  transform = (value?: string | null): string => formatAge(value);
}

/** Todos los pipes de formato, para importarlos de una vez en una plantilla. */
export const FORMAT_PIPES = [
  DatePipe,
  TimePipe,
  DateTimePipe,
  RelativePipe,
  BobPipe,
  NumberPipe,
  BytesPipe,
  DocumentPipe,
  AgePipe,
] as const;
