export type LabelFormat = 'zpl' | 'clp' | 'epl' | 'html';

export function getAcceptHeader(format: LabelFormat): string {
  switch (format) {
    case 'html':
      return 'text/html';
    case 'zpl':
      return 'text/vnd.zebra-zpl';
    case 'clp':
      return 'text/vnd.citizen-clp';
    case 'epl':
      return 'text/vnd.eltron-epl';
    default:
      return 'text/vnd.zebra-zpl';
  }
}