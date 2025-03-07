export class Coord {
    constructor(r, c) {
        this.r = r;
        this.c = c;
    }
    toString() {
        return `${this.r},${this.c}`;
    }
    inBounds(dim) {
        if (this.r < 0 || this.r >= dim) { return false; }
        if (this.c < 0 || this.c >= dim) { return false; }
        return true;
    }
    equals(o) {
        if(!o){ return false; }
        return (o.r == this.r && o.c == this.c);
    }
    getNeigh() {
        return [
            new Coord(this.r - 1, this.c),
            new Coord(this.r, this.c + 1),
            new Coord(this.r + 1, this.c),
            new Coord(this.r, this.c - 1)
        ];
    }
    static dist(a, b) {
        let diffR = Math.abs(b.r - a.r);
        let diffC = Math.abs(b.c - a.c);
        return diffR + diffC;
    }
    static ringDist(a, b) {
        let diffR = Math.abs(b.r - a.r);
        let diffC = Math.abs(b.c - a.c);
        return Math.max(diffR, diffC);
    }
    static isCoord(str) {
        const regex = /^(-?\d+),(-?\d+)$/;
        return regex.test(str);
    }
    static getCoord(str) {
        const regex = /^(-?\d+),(-?\d+)$/;
        let res = regex.exec(str);
        return new Coord(Number(res[1]), Number(res[2]));
    }
}

export function crd () {
    if(arguments.length == 1){
        if(arguments[0] == null){ return null; }
        return new Coord(arguments[0].r, arguments[0].c);
    }else if(arguments.length == 2){
        return new Coord(...arguments);
    }
};