


export class DLXMatrix {
    root: DLXNode;
    all_nodes: Array<DLXNode>;
    rowInfo: Array<string>;
    nRows: number;
    nCols: number;

    private constructor(root: DLXNode, all_nodes: Array<DLXNode>, rowInfo: Array<string>, nRows: number, nCols: number) {
        this.root = root;
        this.all_nodes = all_nodes.slice();
        this.rowInfo = rowInfo.slice();
        this.nRows = nRows;
        this.nCols = nCols;
    }

    public GetRowNames() {
        return this.rowInfo; // TODO - make this readonly somehow
    }

    solutionSet: Array<Array<any>> = new Array<Array<any>>();
    curSol: Array<any> = new Array<any>();

    /**
     * Solves the current dlx matrix.
     * 
     * The output is a list of solutions. 
     * Each solution is another list of row info objects, originally passed in via the 'rowInfo' param of the Initialize function.
     */
    public Solve(): Array<Array<any>> {
        this.solutionSet = [];
        this.curSol = [];

        this.SolveR(0);

        return this.solutionSet.map(x => x.slice());
    }

    private SolveR(depth: number): void {
        // check if there is a column (constraint) to satisfy.
        if (this.root.right === this.root) {
            // slice deepcopies array
            this.solutionSet.push(this.curSol.slice());
            return;
        }

        // find a column (constraint) to satisfy.
        let c = DLXMatrix.GetColumn(this.root);

        // find a row which satisfies the current constraint.
        let r = c.down;

        // kill off this column since the constraint is satisfied.
        DLXMatrix.CoverColumn(c);

        while (r !== c) {
            // push a solution onto the sol stack
            this.curSol.push(this.rowInfo[r.rowId]);

            // kill all columns (constraints) that would be satisfied by choosing this row.
            // this also removes any rows that satisfy the removed options.
            let d = r.right;
            while (r !== d) {
                DLXMatrix.CoverColumn(d.col);
                d = d.right;
            }

            // perform recursion upon this new matrix state
            this.SolveR(depth + 1);

            // revives all columns / rows that were killed previously.
            // this must be done in the reverse order as before.
            d = r.left;
            while (r !== d) {
                DLXMatrix.UncoverColumn(d.col);
                d = d.left;
            }

            // proceed onto the next row which satisfies the current constraint.
            r = r.down;

            // pop the current solution off the sol stack
            this.curSol.pop();
        }

        // restore the column that was covered.
        DLXMatrix.UncoverColumn(c);
    }

    public toString(): string {
        // arrays are sparse in javascript.
        // out of bounds assignment will expand array up to the assigned index.
        // the assigned index will contain the assigned value. 
        // all other slots will be filled with 'undefined'.
        let map: boolean[][] = DLXMatrix.New2dArray(this.nRows, this.nCols);

        let sb: string = "";
        let padSize: number = Math.max(...this.rowInfo.map(x => x.length));

        /*
        let c = this.root.right;
        while (c !== this.root) {
            let r = c.down;
            while (r !== c) {
                map[r.rowId][r.colId] = true;
                r = r.down;
            }
            c = c.right;
        }*/

        this.all_nodes.forEach((node) => {
            if(node.rowId >= 0 && node.colId >= 0 && node.IsActive)
                map[node.rowId][node.colId] = true;
        });

        let rowIdx = 0;
        this.rowInfo.forEach((rowName) => {
            sb += rowName.padEnd(padSize) + ": ";

            for (let colIdx = 0; colIdx < this.nCols; colIdx++) {
                sb += (map[rowIdx][colIdx] ? '1' : '0') + " ";
            }

            sb += '\n';
            rowIdx++;
        });

        console.assert(rowIdx == this.nRows);

        return sb;
    }

    /**
     * Initialize a matrix based on the provided params.
     * 
     * Possible optimization to consider: 
     *  change matrix to list of columns, where each 'column' is another list which holds
     *  indices to columns which contain 1. this will avoid iteration overhead.
     * @param rows Number of rows in the data array
     * @param cols Number of columns in the data array
     * @param m Matrix containing the data (auto converted to boolean using js if statement).
     * @param nPrimaryCols If the matrix has secondary columns, then nPrimaryCols is the number of the primary columns. By default, this is equal to nCols.
     */
    public static Initialize(nRows: number, nCols: number, rowInfo: any[], data: number[][], nPrimaryCols?: number): DLXMatrix {
        // Array<T> is used in favor of T[] when the length of the array in question is expected to be changed.
        let nodeList: Array<DLXNode> = [];

        let root = new DLXNode({
            rowId: -1, colId: -1, label: "root"
        });

        nodeList.push(root);

        let secondaryColOffset = nPrimaryCols || nCols; // offset of where secondary column begins, inclusive.
        let colList = new Array(nCols);

        // Init header row
        // Assume nCols >= 1
        colList[0] = new DLXNode({
            rowId: -1, colId: 0
        });

        colList[0].up = colList[0];
        colList[0].down = colList[0];

        for (let i = 1; i < nCols; i++) {
            colList[i] = new DLXNode({
                rowId: -1, colId: i
            });
            colList[i].up = colList[i];
            colList[i].down = colList[i];

            if (i < secondaryColOffset) {
                colList[i - 1].right = colList[i];
                colList[i].left = colList[i - 1];
            } else {
                colList[i].left = colList[i];
                colList[i].right = colList[i];
            }
        }

        colList[0].left = root;
        colList[secondaryColOffset - 1].right = root;
        root.right = colList[0];
        root.left = colList[secondaryColOffset - 1];
        root.up = root;
        root.down = root;

        // Label header row
        for (let i = 0; i < nCols; i++) {
            colList[i].label = "Column Header " + i;
        }

        nodeList.push(...colList);
        // Populate constraint rows. p-prefix indicates position on the puzzle board itself, not the DLX matrix.
        for (let rowId = 0; rowId < nRows; rowId++) {
            let rowNodes: DLXNode[] = [];
            for (let colId = 0; colId < nCols; colId++) {
                if (!data[rowId][colId]) continue;

                // Generate chain of links for a single row
                rowNodes.push(new DLXNode({
                    rowId: rowId,
                    colId: colId,
                    label: rowInfo[rowId],
                    info: rowInfo[rowId]
                }));
                // label: `${colId < secondaryColOffset ? "Primary" : "Secondary"} cell at row ${rowId} col ${colId}`
                let i = rowNodes.length - 1; // index of last element of row nodes array

                rowNodes[i].up = rowNodes[i];
                rowNodes[i].down = rowNodes[i];

                if (i > 0) {
                    rowNodes[i - 1].right = rowNodes[i];
                    rowNodes[i].left = rowNodes[i - 1];
                } else {
                    rowNodes[i].left = rowNodes[i];
                    rowNodes[i].right = rowNodes[i];
                }
            }

            // Connect first and last nodes within this chain of links
            rowNodes[0].left = rowNodes[rowNodes.length - 1];
            rowNodes[rowNodes.length - 1].right = rowNodes[0];

            // Push this chain of links down the correct columns
            rowNodes.forEach(node => {
                let c = colList[node.colId];
                let d = c.up;

                node.up = d;
                node.down = c;

                c.up = node;
                d.down = node;

                node.col = c;

                c.size += 1;
            });

            nodeList.push(...rowNodes);
        }

        return new DLXMatrix(root, nodeList, rowInfo, nRows, nCols);
    }

    private static CoverColumn(c: DLXNode): void {
        c.right.left = c.left;
        c.left.right = c.right;

        c.IsActive = false;

        let r = c.down;
        while (r !== c) {
            r.IsActive = false;
            let d = r.right;
            while (r !== d) {
                d.up.down = d.down;
                d.down.up = d.up;
                d.col.size -= 1;
                d.IsActive = false;
                d = d.right;
            }
            r = r.down;
        }
    }

    private static UncoverColumn(c: DLXNode): void {
        c.right.left = c;
        c.left.right = c;

        c.IsActive = true;

        let r = c.up;
        while (r !== c) {
            r.IsActive = true;
            let d = r.left;
            while (r !== d) {
                d.up.down = d;
                d.down.up = d;
                d.col.size += 1;
                d.IsActive = true;
                d = d.left;
            }
            r = r.up;
        }
    }

    private static GetColumn(root: DLXNode): DLXNode {
        console.assert(root.right !== root, "GetColumn called on empty header");

        let c = root.right;
        let m = c;

        let size = -1;

        while (c !== root) {
            if (c.size < size || size == -1) {
                size = c.size;
                m = c;
            }

            c = c.right;
        }
        return m;
    }

    public static New2dArray(dim1size: number, dim2size: number): any[][] {
        let output = [];
        for (let i = 0; i < dim1size; i++) {
            //only need to push new Array() without specifying size.
            //this is because of the boundless array access leniency property.
            output.push(new Array(dim2size));
        }
        return output;
    }
}

export class DLXNode {
    public IsActive: boolean;

    public up: DLXNode;
    public down: DLXNode;
    public left: DLXNode;
    public right: DLXNode;

    public col: DLXNode;

    public label: string;
    public info: any;
    public rowId: number;
    public colId: number;

    private _size: number;

    public get size(): number {
        if (this.rowId != -1 || this.colId == -1) {
            throw "Only header nodes have sizes."
        }
        return this._size;
    }

    public set size(value: number) {
        this._size = value;
    }

    constructor(params: { rowId, colId, label?, info?}) {
        this.rowId = params.rowId;
        this.colId = params.colId;
        this.label = params.label || "";
        this.up = null;
        this.down = null;
        this.left = null;
        this.right = null;
        this.info = params.info;
        this.size = 0;
        this.IsActive = true;
    }
}

