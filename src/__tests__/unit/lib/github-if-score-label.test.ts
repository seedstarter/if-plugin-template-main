import {GithubIFScoreLabel} from '../../../lib/github-if-score-label';
import {CustomError} from '../../../lib/github-if-score-label/types';
import {PluginInterface} from '../../../lib/types/interface';
import * as fs from 'fs';
import * as YAML from 'yaml';

describe('lib/github-actions-importer: ', () => {
  describe('MyCustomPlugin(): ', () => {
    it('has metadata field.', () => {
      const pluginInstance = GithubIFScoreLabel({});

      expect(pluginInstance).toHaveProperty('metadata');
      expect(pluginInstance).toHaveProperty('execute');
      expect(pluginInstance.metadata).toHaveProperty('kind');
      expect(typeof pluginInstance.execute).toBe('function');
    });

    describe('execute(): ', () => {
      let pluginInstance: PluginInterface;

      beforeEach(async () => {
        pluginInstance = GithubIFScoreLabel({});
        await pluginInstance.execute([], {
          'github/output-value-0': 'carbon-embodied',
        });
      });

      afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
      });

      it('sets plugin config properties', () => {
        const isConfig = pluginInstance.getPluginConfig();

        expect(isConfig['github/output-value-0']).toContain('carbon-embodied');
      });

      it('should throw an error in case node arguments are not set properly', () => {
        const mockProcessOn = jest.spyOn(process, 'on');
        const beforeExitHandler = mockProcessOn.mock.calls.find(
          call => call[0] === 'beforeExit'
        );
        if (beforeExitHandler) {
          beforeExitHandler[1]();
        }
        pluginInstance.getSubBeforeExit()();

        const nodeArgs = {
          pathDir: '/bla/bla',
          pathFile: 'hello.yml',
        };

        const getIFOutputYML = pluginInstance.getIFOutputYML();
        expect(() => {
          getIFOutputYML(nodeArgs);
        }).toThrow(CustomError);
      });
    });

    describe('reading, comparing and converting IF outputted file and generating workflow file', () => {
      let pluginInstance: PluginInterface;

      beforeEach(async () => {
        pluginInstance = GithubIFScoreLabel({});
        await pluginInstance.execute([], {
          'github/output-value-0': 'carbon-embodied',
        });
        const mockProcessOn = jest.spyOn(process, 'on');
        const beforeExitHandler = mockProcessOn.mock.calls.find(
          call => call[0] === 'beforeExit'
        );
        if (beforeExitHandler) {
          beforeExitHandler[1]();
        }
        pluginInstance.getSubBeforeExit()();
      });

      afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
      });

      it('should throw an error in case IF outputted YML file has no "output" property', () => {
        const ifOutputYMLJsObj = {
          name: '',
          tree: {
            children: {
              child: {},
            },
          },
        };

        jest.mock('../../../lib/github-if-score-label', () => ({
          getIFOutputYML: () => {
            return jest.fn().mockReturnValue({...ifOutputYMLJsObj});
          },
        }));

        const getAndSetIFOutputsValues =
          pluginInstance.getAndSetIFOutputsValues();

        expect(() => {
          getAndSetIFOutputsValues(ifOutputYMLJsObj);
        }).toThrow(CustomError);
      });

      it('should throw an error in case no match found between IF generated YML and plugin configurations', () => {
        const ifOutputYMLJsObj = {
          name: '',
          tree: {
            children: {
              child: {
                outputs: [
                  {
                    'grid/carbon-intensity': 800,
                    'device/emissions-embodied': 1533.12,
                    'device/expected-lifespan': 94608000,
                    'resources-total': 8,
                    'functional-unit-time': '1 min',
                  },
                ],
              },
            },
          },
        };

        jest.mock('../../../lib/github-if-score-label', () => ({
          getIFOutputYML: () => {
            return jest.fn().mockReturnValue({...ifOutputYMLJsObj});
          },
        }));

        const getAndSetIFOutputsValues =
          pluginInstance.getAndSetIFOutputsValues();

        expect(() => {
          getAndSetIFOutputsValues(ifOutputYMLJsObj);
        }).toThrow(CustomError);
      });

      it('should return an object containing configured property for a plugin use and set it a matched value from IF outputted YML ', () => {
        const ifOutputYMLJsObj = {
          name: '',
          tree: {
            children: {
              child: {
                outputs: [
                  {
                    'grid/carbon-intensity': 800,
                    'device/emissions-embodied': 1533.12,
                    'device/expected-lifespan': 94608000,
                    'resources-total': 8,
                    'functional-unit-time': '1 min',
                    'carbon-embodied': 0.007292237442922374,
                  },
                ],
              },
            },
          },
        };

        jest.mock('../../../lib/github-if-score-label', () => ({
          getIFOutputYML: () => {
            return jest.fn().mockReturnValue({...ifOutputYMLJsObj});
          },
        }));

        const getAndSetIFOutputsValues =
          pluginInstance.getAndSetIFOutputsValues();
        getAndSetIFOutputsValues(ifOutputYMLJsObj);
        const ifOutputsValues = pluginInstance.getIfOutputsValues();
        expect(ifOutputsValues['carbon-embodied']).toBeDefined();
      });

      it('should throw an error in case workflow parsed Object is corrupted', () => {
        const ifOutputYMLJsObj = {
          name: '',
          tree: {
            children: {
              child: {
                outputs: [
                  {
                    'grid/carbon-intensity': 800,
                    'device/emissions-embodied': 1533.12,
                    'device/expected-lifespan': 94608000,
                    'resources-total': 8,
                    'functional-unit-time': '1 min',
                    'carbon-embodied': 0.007292237442922374,
                  },
                ],
              },
            },
          },
        };

        jest.mock('../../../lib/github-if-score-label', () => ({
          getIFOutputYML: () => {
            return jest.fn().mockReturnValue({...ifOutputYMLJsObj});
          },
        }));

        const workflowObj = {
          name: 'Update README',
          on: ['push'],
          jobs: {'update-readme': {'runs-on': 'ubuntu-latest', steps: []}},
        };
        const getAndSetIFOutputsValues =
          pluginInstance.getAndSetIFOutputsValues();
        getAndSetIFOutputsValues(ifOutputYMLJsObj);
        const setDynamicParamsWorkflowYML =
          pluginInstance.setDynamicParamsWorkflowYML();

        expect(() => {
          setDynamicParamsWorkflowYML(workflowObj);
        }).toThrow(CustomError);
      });

      it('should generate and write the resulted workflow YML file into IF root directory', () => {
        const ifOutputYMLJsObj = {
          name: '',
          tree: {
            children: {
              child: {
                outputs: [
                  {
                    'grid/carbon-intensity': 800,
                    'device/emissions-embodied': 1533.12,
                    'device/expected-lifespan': 94608000,
                    'resources-total': 8,
                    'functional-unit-time': '1 min',
                    'carbon-embodied': 0.007292237442922374,
                  },
                ],
              },
            },
          },
        };

        jest.mock('../../../lib/github-if-score-label', () => ({
          getIFOutputYML: () => {
            return jest.fn().mockReturnValue({...ifOutputYMLJsObj});
          },
        }));

        const workflowObj = {
          'runs-on': 'ubuntu-latest',
          steps: [
            {name: 'Check out the repository', uses: 'actions/checkout@v2'},
            {
              name: 'Update README',
              run:
                'FILE_PATH="./README.md"\n' +
                `echo '<image width="40" height="40" src="https://if.greensoftware.foundation/img/logo.svg">' >> $FILE_PATH\n`,
            },
            {
              name: 'Extract branch name',
              shell: 'bash',
              run: 'echo "branch=${GITHUB_HEAD_REF:-${GITHUB_REF#refs/heads/}}"',
              id: 'extract_branch',
            },
            {
              name: 'Commit and Push Changes',
              env: [Object],
              run:
                'git config --global user.name "${{github.actor}}"\n' +
                'git config --global user.email "${{github.actor}}@users.noreply.github.com"\n' +
                'git add README.md\n' +
                'git commit -m "IF score label was added to README.md"\n' +
                'git push origin ${{ steps.extract_branch.outputs.branch }}\n',
            },
          ],
        };

        const mockedYAMLString =
          ' run: | git config --global user.name "${{github.actor}}" git config --global user.email "${{github.actor}}@users.noreply.github.com"';
        jest.spyOn(YAML, 'stringify').mockReturnValue(mockedYAMLString);
        const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync');
        const generateWorkflowYML = pluginInstance.generateWorkflowYML();
        generateWorkflowYML(workflowObj);
        const workflowYmlPath = pluginInstance.workflowYmlPath();

        expect(mockWriteFileSync).toHaveBeenCalledWith(
          workflowYmlPath,
          mockedYAMLString
        );
      });
    });
  });
});
