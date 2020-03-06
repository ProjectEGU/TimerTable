/**
 * As React does not work well with nested states,
 * we will create a wrapper with a pointer to a mutable object.
 * 
 * Every time we modify that object, we
 * create a new wrapper for that object.
 * 
 * The new wrapper will have a different pointer.
 * Therefore, it will be considered as a different object.
 * 
 * As all nested objects are still the same reference,
 * nested objects should be pseudo-immutable, as they
 * may be passed into components as props.
 * */
export class Tagged<DataType> {
    data: DataType;
    constructor(data: DataType) {
        this.data = data;
    }
}