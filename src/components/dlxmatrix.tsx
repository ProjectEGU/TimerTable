import { CourseSelection } from "./course";

export type Solution<RowType> = { data: Array<RowType>, score: number }

export type DLXEvaluator<StateType, RowType> = {
    /** a helper state*/
    curState: StateType;

    /** called when a row is added, with the curState as argument*/
    onAddRow: (helperState: StateType, row: RowType) => void;

    /** called when a row is removed, with the curState as argument*/
    onRemoveRow: (helperState: StateType, row: RowType) => void;
    /** called when the algorithm terminates - the state should be reset here*/
    onTerminate: (helperState: StateType) => void;

    /** called when a solution is recorded, with the curState as argument*/
    onRecordSolution?: (helperState: StateType) => void;

    /** the evaluateIteration function determines if iteration should continue, stop, or if a solution should be marked.
     * it should only make use of the helper state. it doesn't make sense to be processing the current solution set every iteration, as that is too cpu-consuming.
     * 
     * note: Not implemented by Solve_YFSmod. */
    evaluateIteration?: (helperState: StateType, kthMaxScore: number) => DLXIterationAction;

    /**
     * Returns the given score for the current state.
     * The score should be always be POSITIVE AND DECREASING as rows are added.
     * The DECREASING condition is in order to be compatible with the pruning optimzations in the DLX Search Algorithm.
     * The POSITIVE condition is to take advantage of significant performance gains, 
     * likely related to a difference in how V8 engine handles JIT for negative numbers comparison vs positive numbers.
     * The hook.curState is passed into the current function.
     * */
    evaluateScore?: (helperState: StateType) => number;
}

export enum DLXIterationAction {
    /** Terminates as a solution and does not branch further */
    EvaluateSolution,
    Continue,
    Prune
}

enum DLXState {
    FORWARD, ADVANCE, BACKUP, RECOVER, DONE
}

export class DLXMatrix<RowType> {
    root: DLXNode;
    all_nodes: Array<DLXNode>;
    rowInfo: Array<RowType>;
    nRows: number;
    nCols: number;

    colInfo;
    private constructor(root: DLXNode, all_nodes: Array<DLXNode>, rowInfo: Array<RowType>, nRows: number, nCols: number) {
        this.root = root;
        this.all_nodes = all_nodes.slice();
        this.rowInfo = rowInfo.slice();
        this.nRows = nRows;
        this.nCols = nCols;
    }

    public GetRowNames() {
        return this.rowInfo;
    }

    /**
    * Sets a limit to the maximum number of solutions returned by Solve(). 
    * Any nonpositive number will indicate no limit.
    */
    solutionLimitReached: boolean = false;
    solutionLimit: number = -1;
    public SetSolutionLimit(solution_limit: number) {
        this.solutionLimit = solution_limit;
    }

    /**
     * Sets the evaluator for the current DLX matrix.
     * */
    evaluator: DLXEvaluator<any, RowType>;
    public SetEvaluator<StateType = any>(evaluator: DLXEvaluator<StateType, RowType>) {
        this.evaluator = evaluator;
    }

    solutionSortFn: (a: { score: number }, b: { score: number }) => number = (a, b) => {
        return b.score - a.score;
    }

    /**
     * Solves the current dlx matrix.
     * 
     * The output is a list of solutions. 
     * Each solution is another list of row info objects, originally passed in via the 'rowInfo' param of the Initialize function.
     * 
     * top_n indicates to select the top nth solutions to be output. In this case, the solution limit will act as the maximum number of solutions to consider.
     */
    public Solve(top_n?: number): Solution<RowType>[] {
        let solutionSet: Array<Solution<RowType>> = new Array<Solution<RowType>>();
        let curSol: Array<RowType> = new Array<RowType>();

        let kthMaxScore: number = -Infinity;
        let solutionCount: number = 0; // the number of solutions evaluated

        let terminate = false;
        let depth = 0;
        let selections: DLXNode[] = [];
        let curHeader: DLXNode;
        let curChoice: DLXNode;
        let curScore = 0

        this.solutionLimitReached = false;

        let state: DLXState;
        state = DLXState.FORWARD as any;

        let addToSol = (newScore) => {
            let newSolution: RowType[] = [];
            for (let i = 0; i <= depth; i++) {
                newSolution.push(selections[i].rowInfo);
            }
            solutionSet.push({ data: newSolution, score: newScore });
        }

        /** Add to solution set, and set the state accordingly. If the score is less than the kth best,
         * then it would have already been pruned in the ADVANCE stage.
         */
        let evaluateSolution = (score) => {
            // if top_n defined and not yet list length: just add
            // if top_n defined and list length: add, sort, remove min
            // if top_n not defined then just add
            // at the end, if list length < top_n, then sort it

            solutionCount += 1;
            if (solutionCount % 500000 == 0) console.log(solutionCount);

            if (!top_n) {
                addToSol(score);
            }
            else if (solutionSet.length < top_n) {
                addToSol(score);
                if (score < kthMaxScore)
                    kthMaxScore = score;

                if (solutionSet.length == top_n)
                    solutionSet.sort(this.solutionSortFn);
                // console.log(solutionSet.map(x => x.score).join(", ") + ": added to solution " + curScore + "   new kthMax: " + kthMaxScore);
            } else { // top_n && solutionSet.length >= top_n
                addToSol(score);
                solutionSet.sort(this.solutionSortFn);
                solutionSet.length = top_n; // delete last element
                kthMaxScore = solutionSet[top_n - 1].score;

                // console.log(solutionSet.map(x => x.score).join(", ") + ": added to solution " + curScore + "   new kthMax: " + kthMaxScore);
            }
            this.evaluator?.onRecordSolution?.(this.evaluator.curState);
            if (this.solutionLimit > 0 && solutionCount >= this.solutionLimit) {
                this.solutionLimitReached = true;
                // if the desired solution count is reached, then stop iterating:
                state = DLXState.DONE;
            } else {
                // if we want to continue enumerating solutions, then proceed down to the next row.
                state = DLXState.RECOVER;
            }
        };

        while (!terminate) {
            switch (state) {
                case DLXState.FORWARD:
                    // find a column (constraint) to satisfy.
                    curHeader = DLXMatrix.GetColumn(this.root);

                    // kill off this column since the constraint is satisfied.
                    DLXMatrix.CoverColumn(curHeader);

                    // find a row which satisfies the current constraint.
                    // mark as the current choice.
                    curChoice = curHeader.down;
                    selections[depth] = curChoice;

                    // with the current candidate row, go to the selection stage
                    state = DLXState.ADVANCE;
                    break;
                case DLXState.ADVANCE:
                    // if we have exhausted the rows that satisfy this constraint, then we need to unselect the current constraint
                    if (curChoice === curHeader) {
                        state = DLXState.BACKUP;
                        break;
                    }

                    // proceed to choose the row.
                    this.evaluator?.onAddRow(this.evaluator.curState, curChoice.rowInfo);

                    // check if it's worth to continue further.
                    curScore = this.evaluator?.evaluateScore(this.evaluator.curState) || 0;
                    // console.log(solutionSet.map(x => x.score).join(", ") + ": curScore " + curScore);
                    let iterAction: DLXIterationAction = this.evaluator?.evaluateIteration?.(this.evaluator.curState, kthMaxScore) || DLXIterationAction.Continue as any;
                    if (iterAction == DLXIterationAction.Prune) {
                        state = DLXState.RECOVER; // if not worth continuing, then go straight to the next row
                        break;
                    } else if (iterAction == DLXIterationAction.EvaluateSolution) {
                        evaluateSolution(curScore);
                        // evaluateSolution will change the state:
                        // if the desired solution count is reached, then stop iterating: state = DLXState.DONE
                        // if we want to continue enumerating solutions, then proceed down to the next row: state = DLXState.RECOVER
                        break;
                    } else if (top_n
                        && solutionSet.length >= top_n
                        && curScore < kthMaxScore) {
                        // console.log("---prune---: " + curScore + " < " + kthMaxScore);
                        state = DLXState.RECOVER; // if current score is already worse than minimal in solution set, then do not continue
                        break;
                    }

                    // kill all columns (constraints) that would be satisfied by choosing this row.
                    // this also removes any rows that satisfy the removed options.
                    for (let pp = curChoice.right; pp !== curChoice; pp = pp.right) {
                        DLXMatrix.CoverColumn(pp.col);
                    }

                    // if all constraints have been satisfied, a solution is found
                    if (this.root.right === this.root) {
                        evaluateSolution(curScore);
                        break;
                    }

                    // otherwise, continue to choose another constraint to satisfy
                    depth += 1;
                    state = DLXState.FORWARD;
                    break;
                case DLXState.BACKUP:
                    // restore the constraint column that was covered.
                    DLXMatrix.UncoverColumn(curHeader);

                    // if the depth is 0 then we have made a full traversal through the matrix.
                    if (depth === 0) {
                        state = DLXState.DONE;
                        break;
                    }

                    // revert to the previous row and the constraint column that it was chosen for
                    depth -= 1;
                    curChoice = selections[depth];
                    curHeader = curChoice.col;

                    // proceed to advance to the next row that satisfies this constraint.
                    state = DLXState.RECOVER;
                    break;
                case DLXState.RECOVER: // uncover current row and move to the next row
                    // revives all columns / rows that were killed by selecting this row.
                    // this must be done in the reverse order as before.
                    for (let pp = curChoice.left; pp !== curChoice; pp = pp.left) {
                        DLXMatrix.UncoverColumn(pp.col);
                    }

                    // move down to the next choice for the current constraint.
                    this.evaluator?.onRemoveRow(this.evaluator.curState, curChoice.rowInfo);
                    curChoice = curChoice.down;
                    selections[depth] = curChoice;

                    // repeat the selection process for the new candidate row
                    state = DLXState.ADVANCE;
                    break;
                case DLXState.DONE:
                    this.evaluator?.onTerminate(this.evaluator.curState);
                    terminate = true;
                    break;
                default:
                    break;
            }
        }

        // if we never reached the top_n solutions, then sort the solution set
        if ((!top_n && this.evaluator?.evaluateScore) || solutionSet.length < top_n)
            solutionSet.sort(this.solutionSortFn);

        return solutionSet;
    }


    /**
    * Solves the current dlx matrix.
    * 
    * The output is a list of solutions. 
    * Each solution is another list of row info objects, originally passed in via the 'rowInfo' param of the Initialize function.
    * 
    * By making the following assumptions, we can reduce redundant calculations:
    *    - The column headers are arranged in YFS order. The YFS category is stored in the 'label' of each column header.
    *    - The score is compartmentalized into two parts: fall score + winter score
    *        - Once all yearly sections are decided, the fall score and winter score can be optimized independently of each other.
    * 
    * Memoize results from the 2nd semester to avoid re-solving identical subproblems.
    * 
    */
    public Solve_YFSmod<FStateType = any, SStateType = any>(fEval: DLXEvaluator<FStateType, RowType>,
        sEval: DLXEvaluator<SStateType, RowType>,
        top_n?: number): Solution<RowType>[] {

        let solutionSet: Solution<RowType>[] = [];
        let curSol: DLXNode[] = [];

        let kthMaxScore: number = -Infinity;
        let solutionCount: number = 0; // the number of solutions evaluated

        /**
         * Return a column header with a term that matches YFS.
         * If no such column header exists, return null.
         * */
        let GetColumn_YFS = (root: DLXNode, YFS: String): DLXNode => {
            let c = root;
            let m = c;
            let size = -1;
            while (true) {
                c = c.right;
                if (c === root)
                    break;
                if (this.colInfo[c.colId] === YFS && (c.size < size || size == -1)) {
                    size = c.size;
                    m = c;
                }
            }
            return m === root ? null : m;
        }

        let bestWinterSols: { rows: DLXNode[], score: number }[] = [];
        let winterSolsChecked = false;
        let nthBestWinterScore = -Infinity;

        let winterSolOffset = -1;

        let addToSol = (newSolution: DLXNode[], newScore) => {
            let newEntry: RowType[] = [];
            for (let i = 0; i < newSolution.length; i++) {
                newEntry.push(newSolution[i].rowInfo);
            }
            solutionSet.push({ data: newEntry, score: newScore });
        }
        /** Add to solution set, and trim accordingly.
         */
        let evaluateSolution = (sol: DLXNode[], score: number) => {
            // if top_n defined and not yet list length: just add
            // if top_n defined and list length: add, sort, remove min
            // if top_n not defined then just add
            // at the end, if list length < top_n, then sort it
            console.assert(score >= kthMaxScore, "score must be greater than kth max");

            solutionCount += 1;
            if (solutionCount % 500000 == 0) console.log(solutionCount);

            if (!top_n) {
                addToSol(sol, score);
            }
            else if (solutionSet.length < top_n) {
                addToSol(sol, score);
                if (score < kthMaxScore)
                    kthMaxScore = score;

                if (solutionSet.length == top_n)
                    solutionSet.sort(this.solutionSortFn);
            } else { // top_n && solutionSet.length >= top_n
                addToSol(sol, score);
                solutionSet.sort(this.solutionSortFn);
                solutionSet.length = top_n; // delete last element
                kthMaxScore = solutionSet[top_n - 1].score;
            }
            if (this.solutionLimit > 0 && solutionCount >= this.solutionLimit) {
                this.solutionLimitReached = true;
            }
        };

        let SolveR = (depth: number, curYFS: String): void => {
            if (depth > 100)
                throw "Recursion limit exceeded";
            // check if the current limit of solutions has been reached
            if (this.solutionLimitReached) {
                return;
            }

            // check if there is a column (constraint) to satisfy.
            let c = GetColumn_YFS(this.root, curYFS);
            if (c === null) {
                // if all columns for this particular session have been satisfied, then move to next session
                switch (curYFS) {
                    case 'Y':
                        // move into fall
                        SolveR(depth + 1, 'F');

                        // reset winter score after processing all following fall selections
                        bestWinterSols = [];
                        nthBestWinterScore = -Infinity;
                        winterSolsChecked = false;
                        return;
                    case 'F':
                        if (!winterSolsChecked) {
                            // if no winter scores memoized yet, then derive the winter scores:
                            // we try to get the top n winter selections based on current yearly selections
                            winterSolOffset = curSol.length;
                            SolveR(depth + 1, 'S');
                            if (bestWinterSols.length == 0) {
                                nthBestWinterScore = -Infinity;
                                // there is no winter solution at all (due to conflict with yearly selections)
                                // so set the winter score to -infinity. this is expected.
                            } else if (!top_n || bestWinterSols.length < top_n) {
                                bestWinterSols.sort(this.solutionSortFn); // sort by highest score first
                                nthBestWinterScore = bestWinterSols[bestWinterSols.length - 1].score;
                            }

                            winterSolsChecked = true;
                        }

                        // check current fall score against all the best winter solutions (up to n of them)
                        // note: bestWinterSols is sorted by descending score
                        // combine the current fall selections with the top n winter selections (with the current yearly selections fixed)
                        let curFallScore = fEval.evaluateScore(fEval.curState);

                        for (let i = 0; i < bestWinterSols.length; i++) {
                            if (curFallScore + bestWinterSols[i].score <= kthMaxScore)
                                break;
                            let ns = curSol.concat(bestWinterSols[i].rows);
                            evaluateSolution(ns, curFallScore + bestWinterSols[i].score);
                            if (this.solutionLimitReached) 
                                return;
                        }

                        return;
                    case 'S':
                        console.assert(this.root.right === this.root, "columns must be in YFS order!");

                        let winterScore = sEval.evaluateScore(sEval.curState);

                        if (top_n) {
                            if (bestWinterSols.length < top_n) {
                                // if top_n not yet satisfied, push solution and update nthBestScore
                                let ns = curSol.slice(winterSolOffset);
                                bestWinterSols.push({ rows: ns, score: winterScore });
                                if (bestWinterSols.length === top_n) {
                                    bestWinterSols.sort(this.solutionSortFn);
                                    nthBestWinterScore = bestWinterSols[bestWinterSols.length - 1].score;
                                }
                            }
                            else if (winterScore > nthBestWinterScore) {
                                // if the new solution has a better score, push and update nthBestScore
                                let ns = curSol.slice(winterSolOffset)
                                bestWinterSols.push({ rows: ns, score: winterScore });
                                bestWinterSols.sort(this.solutionSortFn);
                                bestWinterSols.length = top_n;
                                nthBestWinterScore = bestWinterSols[top_n - 1].score;
                            }
                        } else { // !top_n
                            let ns = curSol.slice(winterSolOffset)
                            bestWinterSols.push({ rows: ns, score: winterScore });
                        }

                        return;
                    default:
                        console.error("invalid YFS while solving: " + curYFS);
                        return;
                }
            }

            let r = c.down; // find a row which satisfies the current constraint.

            // note: if r === c.down, the below code has no effect.
            DLXMatrix.CoverColumn(c); // kill off this column since the constraint is satisfied.
            while (r !== c) {
                // ensure we traverse in YFS order
                console.assert((r.rowInfo as CourseSelection[])[0].crs.term === curYFS,
                    "YFS column-row mismatch: " + (r.rowInfo as CourseSelection[])[0].crs.term + " " + curYFS);

                if (curYFS === 'Y' || curYFS === 'F') fEval.onAddRow(fEval.curState, r.rowInfo);
                if (curYFS === 'Y' || curYFS === 'S') sEval.onAddRow(sEval.curState, r.rowInfo);

                // perform pruning
                let proceedFlag;
                if (curYFS === 'Y') {
                    let fScore = fEval.evaluateScore(fEval.curState);
                    let sScore = sEval.evaluateScore(sEval.curState);
                    proceedFlag = fScore + sScore > kthMaxScore;
                } else if (curYFS === 'F') {
                    let fScore = fEval.evaluateScore(fEval.curState);
                    let sScore;
                    if (winterSolsChecked)
                        sScore = bestWinterSols.length ? bestWinterSols[0].score : -Infinity;
                    else
                        sScore = sEval.evaluateScore(sEval.curState);
                    proceedFlag = fScore + sScore > kthMaxScore;
                } else if (curYFS === 'S') {
                    let sScore = sEval.evaluateScore(sEval.curState);
                    proceedFlag = sScore > nthBestWinterScore;
                }

                if (proceedFlag) {
                    curSol.push(r);// push a solution onto the sol stack
                    // kill all columns (constraints) that would be satisfied by choosing this row.
                    // this also removes any rows that satisfy the removed options.
                    let d = r.right;
                    while (r !== d) {
                        DLXMatrix.CoverColumn(d.col);
                        d = d.right;
                    }

                    SolveR(depth + 1, curYFS); // perform recursion upon this new matrix state

                    // revives all columns / rows that were killed previously.
                    // this must be done in the reverse order as before.
                    d = r.left;
                    while (r !== d) {
                        DLXMatrix.UncoverColumn(d.col);
                        d = d.left;
                    }
                    curSol.pop();// pop the current solution off the sol stack
                }

                if (curYFS === 'Y' || curYFS === 'F') fEval.onRemoveRow(fEval.curState, r.rowInfo);
                if (curYFS === 'Y' || curYFS === 'S') sEval.onRemoveRow(sEval.curState, r.rowInfo);

                r = r.down;// proceed onto the next row which satisfies the current constraint.

            }

            // restore the column that was covered.
            DLXMatrix.UncoverColumn(c);
        }

        SolveR(0, 'Y');

        // if we never reached the top_n solutions, then sort the solution set
        if (!top_n || solutionSet.length < top_n)
            solutionSet.sort(this.solutionSortFn);
        return solutionSet;
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
        console.assert(root.right !== root, "GetColumn called on empty header row");

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
    public static Initialize<RowType>(nRows: number, nCols: number, rowInfo: RowType[], data: number[][], nPrimaryCols?: number, colInfo?: any[]): DLXMatrix<RowType> {
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

        /*  // debug: print the column labels  @@@@@@
        console.log(rowInfo.map(x => {
            let y = x as unknown as CourseSelection[];
            return y[0].crs.course_code + " " + y[0].sec.section_id;
        }).join("\n"));*/
        /*  //debug: print the data array @@@@
          let ncrow = 0;
          data.forEach(row => {
              let dOut = "";
              let isNCRow = true;
              for (let i = 0; i < nCols; i++) {
                  if (i == nPrimaryCols)
                      dOut += " | ";
                  dOut += row[i] ? "1, " : "0, ";
                  if (i >= nPrimaryCols && row[i])
                      isNCRow = false;
              }
              if (isNCRow) ncrow += 1;
              console.log(dOut + "|"); // this one prints the matrix ---
          });
          console.log(ncrow + " / " + nRows + " nonconflict rows ");*/

        nodeList.push(...colList);
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
        let output = new DLXMatrix<RowType>(root, nodeList, rowInfo, nRows, nCols);
        output.colInfo = colInfo;
        return output;
    }



    public static New2dArray(dim1size: number, dim2size: number): any[][] {
        let output = [];
        for (let i = 0; i < dim1size; i++) {
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
    public rowInfo: any;
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
        this.rowInfo = params.info;
        this.size = 0;
        this.IsActive = true;
    }
}

