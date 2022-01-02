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
    const SQUARES_WIDE = 230;
    const SQUARES_TALL = 170;
    const EMPTY_SQUARE_COLOR = '#999';
    const FISH_COLOR = '#0E0';
    const SHARK_COLOR = '#00F';
    const TICK_SLEEP = 40;
    const UP = 0;
    const RIGHT = 1;
    const DOWN = 2;
    const LEFT = 3;

    let initialFishCount = Math.ceil(SQUARES_WIDE * SQUARES_TALL / 6);
    let initialSharkCount = Math.ceil(SQUARES_WIDE * SQUARES_TALL / 200);
    let fishReproductionPeriod = 130;
    let sharkReproductionPeriod = 50;
    let sharkEnergyPerFish = 2;
    let maxSharkEnergy = 48;
    let canvas;

    wator.start = function() {
        const canvasElement = document.getElementById('main-canvas');

        if (!canvasElement || !canvasElement.getContext) {
            console.error('Canvas not found or not supported');
            return;
        }

        canvasElement.setAttribute('width', (SQUARES_WIDE * SQUARE_SIZE) + '');
        canvasElement.setAttribute('height', (SQUARES_TALL * SQUARE_SIZE) + '');

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

        if (initialFishCount + initialSharkCount > SQUARES_WIDE * SQUARES_TALL) {
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
    function WatorWorld() {
        const self = this;
        self.grid = null;
        self.ticker = null;
        self.liveAnimals = null;

        self.start = function() {
            self.initializeWorld();
            self.startTicker();
        };

        self.initializeWorld = function() {
            self.grid = [];
            for (let i = 0; i < SQUARES_WIDE; i++) {
                self.grid[i] = [];
            }
            self.liveAnimals = new LinkedList();
            canvas.fillStyle = EMPTY_SQUARE_COLOR;
            canvas.fillRect(0, 0, SQUARE_SIZE * SQUARES_WIDE, SQUARE_SIZE * SQUARES_WIDE);
            self.initializeAnimals(FishTraits);
            self.initializeAnimals(SharkTraits);
        };

        self.initializeAnimals = function(animalTraits) {
            for (let animalsPlaced = 0; animalsPlaced < animalTraits.initialCount(); ) {
                const randX = randInt(SQUARES_WIDE);
                const randY = randInt(SQUARES_TALL);

                if (self.grid[randX][randY]) {
                    continue;
                }

                self.addAnimal(animalTraits, randX, randY);
                animalsPlaced++;
            }
        };

        self.startTicker = function() {
            self.ticker = setInterval(self.tick, TICK_SLEEP);
        };

        self.stopTicker = function() {
            clearInterval(self.ticker);
            self.ticker = null;
        };

        self.destroy = function() {
            self.stopTicker();
        };

        self.pausePlay = function() {
            if (self.ticker === null) {
                self.startTicker();
            } else {
                self.stopTicker();
            }
        };

        self.tick = function() {
            for (let animal = self.liveAnimals.first, done = false; !done && animal; ) {
                done = !animal.next;

                // get the next animal now in case this animal dies during the tick
                const nextAnimal = animal.next;
                // get the next, next animal now in case the next animal is eaten during the tick
                const secondNextAnimal = animal.next ? animal.next.next : null;

                animal.animalTraits.tick(animal);

                animal = (nextAnimal && nextAnimal.animalTraits) ? nextAnimal : secondNextAnimal;
            }
        };

        self.addAnimal = function(animalTraits, x, y) {
            const animal = {
                x: x,
                y: y,
                animalTraits: animalTraits,
                reproductionCounter: animalTraits.randomReproductionCounter(),
                energy: animalTraits.randomEnergyLevel()
            };

            self.liveAnimals.add(animal);
            self.putAnimalOnGrid(animal);
        };

        self.removeAnimal = function(animal) {
            // mark as inactive
            animal.animalTraits = null;
            self.liveAnimals.remove(animal);
        };

        self.putAnimalOnGrid = function(animal) {
            self.grid[animal.x][animal.y] = animal;
            canvas.fillStyle = animal.animalTraits.color;
            canvas.fillRect(animal.x * SQUARE_SIZE, animal.y * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
        };

        self.clearSquare = function(x, y) {
            self.grid[x][y] = undefined;
            canvas.fillStyle = EMPTY_SQUARE_COLOR;
            canvas.fillRect(x * SQUARE_SIZE, y * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
        };

        self.getRelativeSquare = function(x, y, direction) {
            switch(direction) {
                case UP:
                    if (y <= 0)
                        return {x: x, y: SQUARES_TALL - 1};  // wrap
                    else
                        return {x: x, y: y - 1};
                case RIGHT:
                    if (x >= SQUARES_WIDE - 1)
                        return {x: 0, y: y};
                    else
                        return {x: x + 1, y: y};
                case DOWN:
                    if (y >= SQUARES_TALL - 1)
                        return {x: x, y: 0};
                    else
                        return {x: x, y: y + 1};
                case LEFT:
                    if (x <= 0)
                        return {x: SQUARES_WIDE - 1, y: y};
                    else
                        return {x: x - 1, y: y};
                default:
                    console.error('Illegal direction: ' + direction);
                    return {x: x, y: y};
            }
        };

        self.move = function(animal, newX, newY) {
            if (animal.reproductionCounter >= animal.animalTraits.reproductionPeriod()) {
                const oldX = animal.x;
                const oldY = animal.y;

                animal.x = newX;
                animal.y = newY;
                animal.reproductionCounter = 0;
                self.putAnimalOnGrid(animal);

                self.addAnimal(animal.animalTraits, oldX, oldY);
            } else {
                self.clearSquare(animal.x, animal.y);
                animal.x = newX;
                animal.y = newY;
                self.putAnimalOnGrid(animal);
            }
        };
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

    function LinkedList() {
        this.first = null;
        this.last = null;
        this.size = 0;
    }

    LinkedList.prototype.add = function(node) {
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
    };

    LinkedList.prototype.remove = function(node) {
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
    };
}());
