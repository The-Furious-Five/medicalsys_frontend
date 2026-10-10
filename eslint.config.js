// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

// Componentes propios que implementan ControlValueAccessor: una <label> que los envuelve si esta
// asociada a un control, aunque la regla no lo reconozca por el nombre de la etiqueta.
const FORM_CONTROL_COMPONENTS = [
  'medsys-date-field',
  'medsys-datetime-field',
  'medsys-number-field',
  'medsys-select',
  'medsys-time-field',
];

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'medsys',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'medsys',
          style: 'kebab-case',
        },
      ],
      // El guion bajo marca lo que se descarta a proposito: campos quitados con el operador rest
      // o parametros que exige una firma.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/label-has-associated-control': [
        'error',
        { controlComponents: FORM_CONTROL_COMPONENTS },
      ],
      // El foco automatico se usa a proposito: al abrir dialogos y hojas (el patron de dialogo de
      // ARIA pide mover el foco adentro) y en los buscadores del mostrador, donde se escribe
      // apenas se entra. No es un descuido que el linter deba vigilar.
      '@angular-eslint/template/no-autofocus': 'off',
    },
  },
]);
