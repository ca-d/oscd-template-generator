export type TreeSelection = {
    [name: string]: TreeSelection;
};
export declare function generateTemplates(selection: TreeSelection, doc: XMLDocument, data: Record<string, any>): {
    enumTypes: Set<Element>;
    daTypes: Set<Element>;
    doTypes: Set<Element>;
    lnTypes: Set<Element>;
};
