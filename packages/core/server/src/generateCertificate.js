// @flow
import type {ServerOptions} from '@parcel/types';
import forge from 'node-forge';
import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import logger from '@parcel/logger';

const DEFAULT_CERTIFICATE_DIR = '.parcel-cert';

export default function generateCertificate(options: ServerOptions) {
  let certDirectory = options.certificateDir || DEFAULT_CERTIFICATE_DIR;

  const privateKeyPath = path.join(certDirectory, 'private.pem');
  const certPath = path.join(certDirectory, 'primary.crt');
  const cachedKey =
    fs.existsSync(privateKeyPath) && fs.readFileSync(privateKeyPath);
  const cachedCert = fs.existsSync(certPath) && fs.readFileSync(certPath);

  if (cachedKey && cachedCert) {
    return {
      key: cachedKey,
      cert: cachedCert
    };
  }

  logger.progress('Generating SSL Certificate...');

  const pki = forge.pki;
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = Date.now().toString();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    {
      name: 'commonName',
      value: 'parceljs.org'
    },
    {
      name: 'countryName',
      value: 'US'
    },
    {
      shortName: 'ST',
      value: 'Virginia'
    },
    {
      name: 'localityName',
      value: 'Blacksburg'
    },
    {
      name: 'organizationName',
      value: 'parcelBundler'
    },
    {
      shortName: 'OU',
      value: 'Test'
    }
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true
    },
    {
      name: 'nsCertType',
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true
    },
    {
      name: 'subjectAltName',
      altNames: [
        {
          type: 6, // URI
          value: 'http://example.org/webid#me'
        },
        {
          type: 7, // IP
          ip: '127.0.0.1'
        }
      ]
    },
    {
      name: 'subjectKeyIdentifier'
    }
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const privPem = pki.privateKeyToPem(keys.privateKey);
  const certPem = pki.certificateToPem(cert);

  mkdirp.sync(certDirectory);
  fs.writeFileSync(privateKeyPath, privPem);
  fs.writeFileSync(certPath, certPem);

  return {
    key: privPem,
    cert: certPem
  };
}
