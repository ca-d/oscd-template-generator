import { cyrb64 } from '@openscd/open-scd-core';
import type { TreeSelection } from '@openscd/oscd-tree-grid';

function describeEnumType(element: Element): { vals: Record<string, string> } {
  const vals: Record<string, string> = {};
  for (const val of Array.from(element.children)
    .filter(child => child.tagName === 'EnumVal')
    .sort(
      (v1, v2) =>
        parseInt(v1.getAttribute('ord') ?? '', 10) -
        parseInt(v2.getAttribute('ord') ?? '', 10)
    ))
    vals[val.getAttribute('ord') ?? ''] = val.textContent ?? '';
  return { vals };
}

function describeDAType(element: Element): {
  bdas: Record<string, Record<string, string | null>>;
} {
  const bdas: Record<string, Record<string, string | null>> = {};
  for (const bda of Array.from(element.children)
    .filter(child => child.tagName === 'BDA')
    .sort((c1, c2) => c1.outerHTML.localeCompare(c2.outerHTML))) {
    const [bType, type, dchg, dupd, qchg] = [
      'bType',
      'type',
      'dchg',
      'dupd',
      'qchg',
    ].map(attr => bda.getAttribute(attr));
    bdas[bda.getAttribute('name') ?? ''] = { bType, type, dchg, dupd, qchg };
  }
  return { bdas };
}

function describeDOType(element: Element) {
  const sdos: Record<string, Record<string, string | null>> = {};
  for (const sdo of Array.from(element.children)
    .filter(child => child.tagName === 'SDO')
    .sort((c1, c2) => c1.outerHTML.localeCompare(c2.outerHTML))) {
    const [name, type, transient] = ['name', 'type', 'transient'].map(attr =>
      sdo.getAttribute(attr)
    );
    sdos[name ?? ''] = { type, transient };
  }
  const das: Record<string, Record<string, string | null>> = {};
  for (const da of Array.from(element.children)
    .filter(child => child.tagName === 'DA')
    .sort((c1, c2) => c1.outerHTML.localeCompare(c2.outerHTML))) {
    const [name, fc, bType, type, dchg, dupd, qchg] = [
      'name',
      'fc',
      'bType',
      'type',
      'dchg',
      'dupd',
      'qchg',
    ].map(attr => da.getAttribute(attr));
    das[name ?? ''] = {
      fc,
      bType,
      type,
      dchg,
      dupd,
      qchg,
    };
  }
  return {
    sdos,
    das,
    cdc: element.getAttribute('cdc'),
  };
}

function describeLNodeType(element: Element) {
  const dos: Record<string, Record<string, string | null>> = {};
  for (const doElement of Array.from(element.children)
    .filter(child => child.tagName === 'DO')
    .sort((c1, c2) => c1.outerHTML.localeCompare(c2.outerHTML))) {
    const [name, type, transient] = ['name', 'type', 'transient'].map(attr =>
      doElement.getAttribute(attr)
    );
    dos[name ?? ''] = { type, transient };
  }
  return {
    dos,
    lnClass: element.getAttribute('lnClass'),
  };
}

const typeDescriptions = {
  EnumType: describeEnumType,
  DAType: describeDAType,
  DOType: describeDOType,
  LNodeType: describeLNodeType,
} as Partial<Record<string, (e: Element) => object>>;

function describeElement(element: Element): object {
  return (
    typeDescriptions[element.tagName]?.(element) ?? { xml: element.outerHTML }
  );
}

function hashElement(element: Element): string {
  return cyrb64(JSON.stringify(describeElement(element)));
}

export type Templates = {
  EnumType: Element[];
  DAType: Element[];
  DOType: Element[];
  LNodeType: Element[];
};

export function generateTemplates(
  selection: TreeSelection,
  doc: XMLDocument,
  data: Record<string, any>,
  lnClass: string
): Templates {
  const types = new Set<string>();
  const elements: Templates = {
    LNodeType: [],
    DOType: [],
    DAType: [],
    EnumType: [],
  };

  function identify(element: Element, name: string): string {
    const hash = hashElement(element);
    const id = `${name}$oscd$_${hash}`;
    element.setAttribute('id', id);
    if (!types.has(id)) {
      types.add(id);
      elements[
        element.tagName as 'LNodeType' | 'DOType' | 'DAType' | 'EnumType'
      ]?.push(element);
    }
    return id;
  }

  function createElement(
    tag: string,
    attrs: Record<string, string | null | undefined> = {}
  ): Element {
    const element = doc.createElementNS(doc.documentElement.namespaceURI, tag);
    Object.entries(attrs)
      .filter(([_name, value]) => value !== null && value !== undefined)
      .forEach(([name, value]) => element.setAttribute(name, value!));
    return element;
  }

  function addEnumType(path: string[], sel: TreeSelection): string {
    let d = data;
    for (const slug of path) d = d[slug].children;

    const vals = [];

    for (const content of Object.keys(sel)) {
      const ord = d[content].literalVal;
      const val = createElement('EnumVal', { ord });
      val.textContent = content;
      vals.push(val);
    }

    vals.sort(
      (v1, v2) =>
        parseInt(v1.getAttribute('ord') ?? '', 10) -
        parseInt(v2.getAttribute('ord') ?? '', 10)
    );

    const enumType = createElement('EnumType');
    vals.forEach(val => enumType.append(val));

    return identify(enumType, path[path.length - 1]);
  }

  function addDAType(
    path: string[],
    sel: TreeSelection,
    underlyingValSel: TreeSelection = {}
  ): string {
    let d = data;
    for (const slug of path.slice(0, -1)) d = d[slug].children;
    const { children, underlyingTypeKind, underlyingType, typeKind } =
      d[path[path.length - 1]];

    if (typeKind !== 'CONSTRUCTED')
      throw new Error(`DAType typeKind is not CONSTRUCTED, but ${typeKind}`);

    const daType = createElement('DAType');

    for (const [name, dep] of Object.entries(children) as [
      string,
      {
        tagName: string;
        transient?: string;
        fc: string;
        dchg?: string;
        dupd?: string;
        qchg?: string;
        typeKind?: 'BASIC' | 'ENUMERATED' | 'CONSTRUCTED' | 'undefined';
        type?: string;
      }
    ][]) {
      // eslint-disable-next-line no-continue
      if (!sel[name]) continue;
      const bda = createElement('BDA', { name });
      if (dep.typeKind === 'BASIC' || !dep.typeKind) {
        bda.setAttribute('bType', dep.type ?? '');
      }
      if (dep.typeKind === 'ENUMERATED') {
        const enumId = addEnumType(path.concat([name]), sel[name]);
        bda.setAttribute('bType', 'Enum');
        bda.setAttribute('type', enumId);
      }
      if (dep.typeKind === 'undefined') {
        if (underlyingTypeKind === 'BASIC')
          bda.setAttribute('bType', underlyingType);
        else if (underlyingTypeKind === 'ENUMERATED') {
          const enumId = addEnumType(
            path.slice(0, -1).concat(['stVal']),
            underlyingValSel
          );
          bda.setAttribute('bType', 'Enum');
          bda.setAttribute('type', enumId);
        } else if (underlyingTypeKind === 'CONSTRUCTED') {
          let daId = '';
          try {
            daId = addDAType(
              path.slice(0, -1).concat(['mxVal']),
              underlyingValSel
            );
          } catch {
            throw new Error(
              `Unexpected selection ${JSON.stringify(
                path
              )} without mxVal sibling`
            );
          }
          bda.setAttribute('bType', 'Struct');
          bda.setAttribute('type', daId);
        } else
          throw new Error(
            `Unexpected underlyingTypeKind ${underlyingTypeKind}`
          );
      }
      if (dep.typeKind === 'CONSTRUCTED') {
        const daId = addDAType(
          path.concat([name]),
          sel[name],
          underlyingValSel
        );
        bda.setAttribute('bType', 'Struct');
        bda.setAttribute('type', daId);
      }
      daType.append(bda);
    }

    return identify(daType, path[path.length - 1]);
  }

  function addDOType(path: string[], sel: TreeSelection): string {
    if (!sel)
      throw new Error(
        `adding DO type for empty selection at ${JSON.stringify(path, null, 2)}`
      );
    let d = data;
    for (const slug of path.slice(0, -1)) d = d[slug].children;

    const dO = d[path[path.length - 1]];
    const doType = createElement('DOType', { cdc: dO.type });

    const deps: [
      string,
      {
        tagName: string;
        transient?: string;
        fc: string;
        dchg?: string;
        dupd?: string;
        qchg?: string;
        typeKind?: 'BASIC' | 'ENUMERATED' | 'CONSTRUCTED' | 'undefined';
        type?: string;
      }
    ][] = Object.entries(dO.children);

    for (const [name, dep] of deps) {
      // eslint-disable-next-line no-continue
      if (!sel[name]) continue;
      if (dep.tagName === 'SubDataObject') {
        const { transient } = dep;
        const type = addDOType(path.concat([name]), sel[name]);
        const sdo = createElement('SDO', { name, transient, type });
        doType.prepend(sdo);
      } else {
        const { fc, dchg, dupd, qchg } = dep;
        const da = createElement('DA', { name, fc, dchg, dupd, qchg });
        if (dep.typeKind === 'BASIC' || !dep.typeKind) {
          da.setAttribute('bType', dep.type ?? '');
        }
        if (dep.typeKind === 'ENUMERATED') {
          const enumId = addEnumType(path.concat([name]), sel[name]);
          da.setAttribute('bType', 'Enum');
          da.setAttribute('type', enumId);
        }
        if (dep.typeKind === 'CONSTRUCTED') {
          const underlyingVal = sel.stVal || sel.mxVal;
          const daId = addDAType(path.concat([name]), sel[name], underlyingVal);
          da.setAttribute('bType', 'Struct');
          da.setAttribute('type', daId);
        }
        doType.append(da);
      }
    }

    return identify(doType, path[path.length - 1]);
  }

  const lnType = createElement('LNodeType', { lnClass });

  Object.keys(selection).forEach(name => {
    const type = addDOType([name], selection[name]);
    const { transient } = data[name];
    const doElement = createElement('DO', { name, type, transient });
    lnType.append(doElement);
  });

  identify(lnType, lnClass);

  return elements;
}
