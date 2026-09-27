import { FormControl } from '@angular/forms';
import { addressWarnings, normalizeAddress, portalAddressValidator } from './portal-address';

describe('portal address', () => {
  it('keeps only the scheme, the host and an unusual port', () => {
    expect(normalizeAddress(' https://School.Example.com/ ')).toBe('https://school.example.com');
    expect(normalizeAddress('HTTP://192.168.1.10:8080')).toBe('http://192.168.1.10:8080');
    expect(normalizeAddress('https://school.example.com:443')).toBe('https://school.example.com');
    expect(normalizeAddress('http://[::1]:8091')).toBe('http://[::1]:8091');
  });

  it.each([
    '',
    'school.example.com',
    'ftp://school.example.com',
    'https://',
    'https://user@school.example.com',
    'https://user:secret@school.example.com',
    'https://school.example.com/portal',
    'https://school.example.com/?a=1',
    'https://school.example.com?',
    'https://school.example.com/#top',
    'https://school example.com',
    `https://${'a'.repeat(300)}.ru`,
  ])('rejects %s', (value) => {
    expect(normalizeAddress(value)).toBeNull();
  });

  it('validates a form field that may stay empty', () => {
    expect(portalAddressValidator(new FormControl('', { nonNullable: true }))).toBeNull();
    expect(
      portalAddressValidator(new FormControl('https://school.example.com', { nonNullable: true })),
    ).toBeNull();
    expect(portalAddressValidator(new FormControl('school', { nonNullable: true }))).toEqual({
      portalAddress: true,
    });
  });

  it('warns about addresses students cannot open', () => {
    const here = 'https://school.example.com';
    expect(addressWarnings('https://school.example.com', here)).toEqual([]);
    expect(addressWarnings('http://localhost:8080', 'http://localhost:8080')).toEqual(['local']);
    expect(addressWarnings('http://127.0.0.1', here)).toEqual(['local', 'elsewhere']);
    expect(addressWarnings('http://[::1]:8091', here)).toEqual(['local', 'elsewhere']);
    expect(addressWarnings('http://192.168.1.10:8080', here)).toEqual([
      'home-network',
      'elsewhere',
    ]);
    expect(addressWarnings('http://172.20.0.5', here)).toEqual(['home-network', 'elsewhere']);
    expect(addressWarnings('http://nas.local', here)).toEqual(['home-network', 'elsewhere']);
    expect(addressWarnings('http://nas', here)).toEqual(['home-network', 'elsewhere']);
    expect(addressWarnings('http://school.example.com', here)).toEqual([
      'unencrypted',
      'elsewhere',
    ]);
    expect(addressWarnings('http://172.32.0.5', 'http://172.32.0.5')).toEqual(['unencrypted']);
  });
});
