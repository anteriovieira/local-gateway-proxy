import { docs } from '../../.source';
import { loader } from 'fumadocs-core/source';
import type { VirtualFile } from 'fumadocs-core/source';

const mdxSource = docs.toFumadocsSource();
const filesValue = mdxSource.files as unknown;
const files: VirtualFile[] =
  typeof filesValue === 'function' ? filesValue() : (filesValue as VirtualFile[]);

export const source = loader({
  baseUrl: '/docs',
  source: { files },
});
