// Instance tracking and management
import { INSTANCE_TO_CLASS_MAP } from '../config/config';

// Export the instance to class map from config
export const instanceToClassMap = INSTANCE_TO_CLASS_MAP;

export let instanceDefinitions: { [key: string]: string } = {};

export function trackInstanceDefinitions(text: string): void {
    const lines = text.split('\n');
    const instanceRegex = /(\w+)\s*=\s*new\s+(\w+)/; // Example: p1 = new Subpopulation
    const subpopRegex = /sim\.addSubpop\("(\w+)",\s*\d+(?:,\s*[^)]*)?\)/; // Example: sim.addSubpop("p1", 100)
    const subpopSplitRegex = /sim\.addSubpopSplit\("(\w+)",\s*\d+(?:,\s*[^)]*)?\)/; // Example: sim.addSubpopSplit("p1", 100, ...)
    const earlyEventRegex = /community\.registerEarlyEvent\("(\w+)",\s*[^)]*\)/;
    const firstEventRegex = /community\.registerFirstEvent\("(\w+)",\s*[^)]*\)/;
    const interactionCallbackRegex = /community\.registerInteractionCallback\("(\w+)",\s*[^)]*\)/;
    const lateEventRegex = /community\.registerLateEvent\("(\w+)",\s*[^)]*\)/;
    const fitnessEffectCallbackRegex = /species\.registerFitnessEffectCallback\("(\w+)",\s*[^)]*\)/;
    const mateChoiceCallbackRegex = /species\.registerMateChoiceCallback\("(\w+)",\s*[^)]*\)/;
    const modifyChildCallbackRegex = /species\.registerModifyChildCallback\("(\w+)",\s*[^)]*\)/;
    const mutationCallbackRegex = /species\.registerMutationCallback\("(\w+)",\s*[^)]*\)/;
    const mutationEffectCallbackRegex =
        /species\.registerMutationEffectCallback\("(\w+)",\s*[^)]*\)/;
    const recombinationCallbackRegex = /species\.registerRecombinationCallback\("(\w+)",\s*[^)]*\)/;
    const reproductionCallbackRegex = /species\.registerReproductionCallback\("(\w+)",\s*[^)]*\)/;
    const survivalCallbackRegex = /species\.registerSurvivalCallback\("(\w+)",\s*[^)]*\)/;

    lines.forEach((line) => {
        let match: RegExpMatchArray | null;
        switch (true) {
            case (match = line.match(instanceRegex)) !== null:
                instanceDefinitions[match![1]] = match![2];
                break;
            case (match = line.match(subpopRegex)) !== null:
                instanceDefinitions[match![1]] = 'Subpopulation';
                break;
            case (match = line.match(subpopSplitRegex)) !== null:
                instanceDefinitions[match![1]] = 'Subpopulation';
                break;
            case (match = line.match(earlyEventRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(firstEventRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(interactionCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(lateEventRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(fitnessEffectCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(mateChoiceCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(modifyChildCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(mutationCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(mutationEffectCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(recombinationCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(reproductionCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(survivalCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
        }
    });
}

