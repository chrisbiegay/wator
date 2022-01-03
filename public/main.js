/*
 * Wa-Tor: An implementation based on the paper by A. K. Dewdney.
 *
 * See http://home.cc.gatech.edu/biocs1/uploads/2/wator_dewdney.pdf
 *
 * Author:  Chris Biegay
 * Created: July 8, 2018
 */

'use strict';

const wator = {};

(function() {
    const SQUARE_SIZE = 2;
    const EMPTY_SQUARE_COLOR = '#999';
    const FISH_COLOR = '#0E0';
    const SHARK_COLOR = '#00F';
    const TICK_SLEEP = 40;
    const UP = 0;
    const RIGHT = 1;
    const DOWN = 2;
    const LEFT = 3;

    let fishReproductionPeriod = 130;
    let sharkReproductionPeriod = 50;
    let sharkEnergyPerFish = 3;
    let maxSharkEnergy = 48;
    let numRows;
    let numColumns;
    let initialFishCount;
    let initialSharkCount;
    let canvas;

    wator.initialize = function() {
        numRows = 170;
        numColumns = determineNumberOfGridColumns();
        initialFishCount = Math.ceil(numColumns * numRows / 6);
        initialSharkCount = Math.ceil(numColumns * numRows / 200);

        const canvasElement = document.getElementById('main-canvas');

        if (!canvasElement || !canvasElement.getContext) {
            console.error('Canvas not found or not supported');
            return;
        }

        canvasElement.setAttribute('width', (numColumns * SQUARE_SIZE) + '');
        canvasElement.setAttribute('height', (numRows * SQUARE_SIZE) + '');

        canvas = canvasElement.getContext('2d');

        wator.populateUIFields();
        wator.watorWorld = new WatorWorld();
        wator.watorWorld.start();
    };

    wator.populateUIFields = function() {
        document.getElementById('fish-initial-count').value = initialFishCount;
        document.getElementById('shark-initial-count').value = initialSharkCount;
        document.getElementById('fish-reproduction-period').value = fishReproductionPeriod;
        document.getElementById('shark-reproduction-period').value = sharkReproductionPeriod;
        document.getElementById('max-shark-energy').value = maxSharkEnergy;
        document.getElementById('shark-energy-per-fish').value = sharkEnergyPerFish;
    };

    wator.loadValuesFromUI = function() {
        const oldInitialFishCount = initialFishCount;
        const oldInitialSharkCount = initialSharkCount;

        initialFishCount = parseInt(document.getElementById('fish-initial-count').value, 10);
        initialSharkCount = parseInt(document.getElementById('shark-initial-count').value, 10);
        fishReproductionPeriod = parseInt(document.getElementById('fish-reproduction-period').value, 10);
        sharkReproductionPeriod = parseInt(document.getElementById('shark-reproduction-period').value, 10);
        maxSharkEnergy = parseInt(document.getElementById('max-shark-energy').value, 10);
        sharkEnergyPerFish = parseInt(document.getElementById('shark-energy-per-fish').value, 10);

        if (initialFishCount + initialSharkCount > numColumns * numRows) {
            initialFishCount = oldInitialFishCount;
            initialSharkCount = oldInitialSharkCount;
            wator.populateUIFields();
            console.log('Initial counts of fish and sharks exceeded the grid size');
        }
    };

    wator.resetWorld = function() {
        wator.loadValuesFromUI();
        wator.watorWorld.destroy();
        wator.watorWorld = new WatorWorld();
        wator.watorWorld.start();
    };

    wator.pausePlay = function() {
        wator.watorWorld.pausePlay();
    };

    function determineNumberOfGridColumns() {
        console.debug(`document.body.clientWidth: ${document.body.clientWidth}`);
        console.debug(`window.innerWidth: ${window.innerWidth}`);

        if (document.body.clientWidth < 500) {
            // fit the width of the screen
            return Math.ceil(document.body.clientWidth / 2) - 1
        } else {
            // for desktop / wide screen viewports
            return 230;
        }
    }

    /** Random int from zero to max, exclusive. */
    function randInt(max) {
        return Math.floor(Math.random() * max)
    }

    /** Randomly execute the predicate for each direction until it returns true. */
    function eachDirectionUntil(predicate) {
        let direction = randInt(4);
        for (let i = 0; i < 4; i++) {
            direction = (direction + i) % 4;
            if (predicate(direction)) {
                break;
            }
        }
    }

    /** Class for managing the grid and animals. */
    class WatorWorld {
        grid = null;
        ticker = null;
        liveAnimals = null;

        start() {
            this.initializeWorld();
            this.startTicker();
        }

        initializeWorld() {
            this.grid = [];
            for (let i = 0; i < numColumns; i++) {
                this.grid[i] = [];
            }
            this.liveAnimals = new LinkedList();
            canvas.fillStyle = EMPTY_SQUARE_COLOR;
            canvas.fillRect(0, 0, SQUARE_SIZE * numColumns, SQUARE_SIZE * numColumns);
            this.initializeAnimals(FishTraits);
            this.initializeAnimals(SharkTraits);
        }

        initializeAnimals(animalTraits) {
            for (let animalsPlaced = 0; animalsPlaced < animalTraits.initialCount(); ) {
                const randX = randInt(numColumns);
                const randY = randInt(numRows);

                if (this.grid[randX][randY]) {
                    continue;
                }

                this.addAnimal(animalTraits, randX, randY);
                animalsPlaced++;
            }
        }

        startTicker() {
            this.ticker = setInterval(() => this.tick(), TICK_SLEEP);
        }

        stopTicker() {
            clearInterval(this.ticker);
            this.ticker = null;
        }

        destroy() {
            this.stopTicker();
        }

        pausePlay() {
            if (this.ticker === null) {
                this.startTicker();
            } else {
                this.stopTicker();
            }
        }

        tick() {
            for (let animal = this.liveAnimals.first, done = false; !done && animal; ) {
                done = !animal.next;

                // get the next animal now in case this animal dies during the tick
                const nextAnimal = animal.next;
                // get the next, next animal now in case the next animal is eaten during the tick
                const secondNextAnimal = animal.next ? animal.next.next : null;

                animal.animalTraits.tick(animal);

                animal = (nextAnimal && nextAnimal.animalTraits) ? nextAnimal : secondNextAnimal;
            }
        }

        addAnimal(animalTraits, x, y) {
            const animal = {
                x: x,
                y: y,
                animalTraits: animalTraits,
                reproductionCounter: animalTraits.randomReproductionCounter(),
                energy: animalTraits.randomEnergyLevel()
            };

            this.liveAnimals.add(animal);
            this.putAnimalOnGrid(animal);
        }

        removeAnimal(animal) {
            // mark as inactive
            animal.animalTraits = null;
            this.liveAnimals.remove(animal);
        }

        putAnimalOnGrid(animal) {
            this.grid[animal.x][animal.y] = animal;
            canvas.fillStyle = animal.animalTraits.color;
            canvas.fillRect(animal.x * SQUARE_SIZE, animal.y * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
        }

        clearSquare(x, y) {
            this.grid[x][y] = undefined;
            canvas.fillStyle = EMPTY_SQUARE_COLOR;
            canvas.fillRect(x * SQUARE_SIZE, y * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
        }

        getRelativeSquare(x, y, direction) {
            switch(direction) {
                case UP:
                    if (y <= 0)
                        return {x: x, y: numRows - 1};  // wrap
                    else
                        return {x: x, y: y - 1};
                case RIGHT:
                    if (x >= numColumns - 1)
                        return {x: 0, y: y};
                    else
                        return {x: x + 1, y: y};
                case DOWN:
                    if (y >= numRows - 1)
                        return {x: x, y: 0};
                    else
                        return {x: x, y: y + 1};
                case LEFT:
                    if (x <= 0)
                        return {x: numColumns - 1, y: y};
                    else
                        return {x: x - 1, y: y};
                default:
                    console.error('Illegal direction: ' + direction);
                    return {x: x, y: y};
            }
        }

        move(animal, newX, newY) {
            if (animal.reproductionCounter >= animal.animalTraits.reproductionPeriod()) {
                const oldX = animal.x;
                const oldY = animal.y;

                animal.x = newX;
                animal.y = newY;
                animal.reproductionCounter = 0;
                this.putAnimalOnGrid(animal);

                this.addAnimal(animal.animalTraits, oldX, oldY);
            } else {
                this.clearSquare(animal.x, animal.y);
                animal.x = newX;
                animal.y = newY;
                this.putAnimalOnGrid(animal);
            }
        }
    }

    const FishTraits = {
        color: FISH_COLOR,
        initialCount: function() { return initialFishCount },
        randomEnergyLevel: function() {},
        randomReproductionCounter: function() { return randInt(fishReproductionPeriod) },
        reproductionPeriod: function() { return fishReproductionPeriod },
        tick: function(animal) {
            eachDirectionUntil(function(direction) {
                const destinationSquare = wator.watorWorld.getRelativeSquare(animal.x, animal.y, direction);
                if (!wator.watorWorld.grid[destinationSquare.x][destinationSquare.y]) {
                    wator.watorWorld.move(animal, destinationSquare.x, destinationSquare.y);
                    return true;
                }
            });

            animal.reproductionCounter++;
        }
    };

    const SharkTraits = {
        color: SHARK_COLOR,
        initialCount: function() { return initialSharkCount },
        randomEnergyLevel: function() { return randInt(maxSharkEnergy) },
        randomReproductionCounter: function() { return randInt(sharkReproductionPeriod) },
        reproductionPeriod: function() { return sharkReproductionPeriod },
        tick: function(shark) {
            let hasEaten = false;

            eachDirectionUntil(function(direction) {
                const destinationSquare = wator.watorWorld.getRelativeSquare(shark.x, shark.y, direction);
                const possibleFish = wator.watorWorld.grid[destinationSquare.x][destinationSquare.y];
                if (possibleFish && possibleFish.animalTraits === FishTraits) {
                    wator.watorWorld.removeAnimal(possibleFish);
                    shark.energy += sharkEnergyPerFish;
                    // limit a shark's energy
                    if (shark.energy > maxSharkEnergy) {
                        shark.energy = maxSharkEnergy;
                    }

                    hasEaten = true;
                    wator.watorWorld.move(shark, destinationSquare.x, destinationSquare.y);
                }

                return hasEaten;
            });

            if (!hasEaten) {
                eachDirectionUntil(function(direction) {
                    const destinationSquare = wator.watorWorld.getRelativeSquare(shark.x, shark.y, direction);
                    if (!wator.watorWorld.grid[destinationSquare.x][destinationSquare.y]) {
                        wator.watorWorld.move(shark, destinationSquare.x, destinationSquare.y);
                        return true;
                    }
                });
            }

            shark.reproductionCounter++;

            if (--shark.energy <= 0) {
                wator.watorWorld.clearSquare(shark.x, shark.y);
                wator.watorWorld.removeAnimal(shark);
            }
        }
    };

    class LinkedList {
        first = null;
        last = null;
        size = 0;

        add(node) {
            if (this.last) {
                this.last.next = node;
                node.previous = this.last;
            } else {
                this.first = node;
                node.previous = null;
            }

            this.last = node;
            node.next = null;

            this.size++;
        }

        remove(node) {
            if (node.previous) {
                node.previous.next = node.next;
            }

            if (node.next) {
                node.next.previous = node.previous;
            }

            if (this.first === node) {
                this.first = node.next;
            }

            if (this.last === node) {
                this.last = node.previous;
            }

            node.next = null;
            node.previous = null;

            this.size--;
        }
    }
}());
