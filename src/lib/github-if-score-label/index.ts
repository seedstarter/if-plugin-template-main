import {
  YourGlobalConfig,
  IFOutputYmlPathInfo,
  WorkflowYMLObj,
  IfOutputsValues,
} from './types';
import {PluginInterface, PluginParams} from '../types/interface';
import * as dotenv from 'dotenv';
import {CustomError} from './types';
import path = require('node:path');
import * as fs from 'fs';
import * as YAML from 'yaml';
import {YAMLError} from 'yaml';

//TODO:: test plugin as if it is a part of unofficial plugins in node_module

export const GithubIFScoreLabel = (
  globalConfig: YourGlobalConfig
): PluginInterface => {
  dotenv.config();
  let rootPath: string = '';
  let ifOutputsValues: IfOutputsValues;
  let workflowJS: WorkflowYMLObj;
  let workflowYmlPath: string = '';
  let pluginConfig: Record<string, any> | undefined;
  let ifOutputYMLJsObj: Record<string, any> | undefined;
  let formattedIfOutputYMLPathInfo: IFOutputYmlPathInfo | undefined;
  let workflowTemplateStr: string = '';
  const workflowTemplatePath =
    './node_modules/@grnsft/if-plugin-template/src/lib/github-if-score-label/assets/template-update-readme.yml';
  let workflowYML: string = '';

  /**
   * Determines the current directory of the Node.js application by referencing index.ts and sets value
   * Determines the --output YML directory or file path by adjusting index value of argvs['--output'] and incrementing by 1, then sets value. Throws an error if value not found.
   * @param argvs: process.argv[]
   * @param values: ['index.ts', '--output']
   * @returns iFOutputYmlPathInfo
   */
  function setIfOutputYMLPathInfo(
    argvs: string[],
    refs: string[]
  ): IFOutputYmlPathInfo {
    let iFOutputYmlPathInfo: IFOutputYmlPathInfo = {
      pathDir: '',
      pathFile: '',
    };
    try {
      argvs.forEach((arg, index) => {
        refs.some(ref => {
          if (arg.includes(ref) && ref === 'index.ts') {
            iFOutputYmlPathInfo.pathDir = process.cwd();
          }
          if (arg.includes(ref) && ref === '--output') {
            iFOutputYmlPathInfo.pathFile = argvs[index + 1];
          }
        });
      });
    } catch {
      throw new CustomError({
        name: 'code error',
        message:
          "It seems like you're missing a required parameter in your Node.js command",
        description:
          'Refer to the README.md for providing all necessary parameters when running the command.',
      });
    }
    return iFOutputYmlPathInfo;
  }

  /**
   * Format and modify the pathDir and pathFile properties of the nodeArgs object based on conditions and patterns.
   * Sets rootPath of running nodejs process as shared variable.
   *
   * @param nodeArgs - IFOutputYmlPathInfo
   * @returns IFOutputYmlPathInfo - Formatted and modified pathDir and pathFile object
   */
  function formatIfOutputYMLPathInfo(
    nodeArgs: IFOutputYmlPathInfo
  ): IFOutputYmlPathInfo {
    nodeArgs['pathDir'] = nodeArgs['pathDir'] + '/';
    rootPath = nodeArgs['pathDir'];
    const pathFileString: string = nodeArgs['pathFile'];
    const parts = pathFileString.split('/').filter(el => el !== '.');
    if (parts.length > 1) {
      parts.map((value, index) => {
        if (value !== parts[parts.length - 1]) {
          nodeArgs['pathDir'] = nodeArgs['pathDir'].concat(value);
          parts.splice(index, 1);
        }
      });
    }
    if (parts.length === 1) {
      nodeArgs['pathFile'] = path.basename(parts[0]).includes('.')
        ? path.basename(parts[0])
        : path.basename(parts[0]) + '.yaml';
    }
    return nodeArgs;
  }

  /**
   * Constructs the full file path by joining pathDir and pathFile in nodeArgs.
   * Reading the contents of the resulted Impact Framework yml, specified by the constructed file path.
   * Parses the resulted Impact Framework yml content and converts it into a JavaScript object.
   * Throws an error if if file doesn't exist or cannot be read.
   *
   * @param nodeArgs - IFOutputYmlPathInfo
   * @returns ifOutputYMLJsObj
   */
  function getIFOutputYML(nodeArgs: IFOutputYmlPathInfo): any {
    const filePath = path.join(nodeArgs.pathDir, nodeArgs.pathFile);
    let fileContents: string = '';
    let ifOutputYMLJsObj;
    try {
      fileContents = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new CustomError({
        name: 'code error',
        message: 'could not read the IF output YML file',
        description:
          'Refer to the README.md to see what you can achieve with this plugin.',
      });
    }
    try {
      ifOutputYMLJsObj = YAML.parseDocument(fileContents).toJS();
    } catch (error: any) {
      if (error instanceof YAMLError) {
        throw new CustomError({
          name: error.name,
          message: error.message,
        });
      }
    }
    return ifOutputYMLJsObj;
  }

  /**
   * The values of parameters configured for the Github-IF-Score-Label plugin's processing will be established upon the output of the Impact Framework,
   * and subsequent comparison of property names within the resultant YML file.
   * Throws an error if outputted YML file has no values at all and if config properties were not set for the plugin in the manifest file.
   *
   * @param fileContent - ifOutputYMLJsObj
   */
  function getAndSetIFOutputsValues(fileContent: any): void {
    if (
      fileContent?.tree?.children?.child['outputs'] &&
      fileContent?.tree?.children?.child['outputs'].length
    ) {
      let hasMatchFlag = false;
      fileContent.tree.children.child['outputs'].map((output: any) => {
        for (const outputKey in output) {
          if (pluginConfig && Object.keys(pluginConfig).length) {
            for (const configKey in pluginConfig) {
              if (outputKey === pluginConfig[configKey]) {
                hasMatchFlag = true;
                ifOutputsValues = {
                  ...ifOutputsValues,
                  [outputKey]: output[outputKey],
                };
              }
            }
          } else {
            throw new CustomError({
              name: 'code error',
              message:
                'Missing properties required by the Github-IF-Score-Label plugin in the manifest file.',
              description:
                'Refer to the README.md to see what you can achieve with this plugin.',
            });
          }
        }
      });
      if (!hasMatchFlag) {
        throw new CustomError({
          name: 'code error',
          message:
            'The YML file generated by the Impact Framework lacks the properties configured for the Github-IF-Score-Label plugin in the manifest file.',
          description:
            'Refer to the README.md to see what you can achieve with this plugin.',
        });
      }
    } else {
      throw new CustomError({
        name: 'code error',
        message: 'The resulting IF yml file is missing "outputs" property.',
        description: "Please check your manifest file and it's configuration.",
      });
    }
  }

  /**
   * Generating a YML file for a GitHub Actions workflow based on a template.
   * Parses the content of a template and converts it into a JavaScript object.
   * Once converted calls setDynamicParams function to set dynamic parameters within the workflow configuration.
   * Writes the generated YML content to a new update-readme.yml at the rootPath.
   *
   */
  function getWorkflowYML(path: string): void {
    try {
      workflowTemplateStr = fs.readFileSync(path, 'utf8');
    } catch (error) {
      if (error instanceof Error) {
        throw new CustomError({
          name: 'code error',
          message: error.message,
        });
      }
    }
    try {
      workflowJS = YAML.parseDocument(workflowTemplateStr).toJS();
    } catch (error) {
      if (error instanceof YAMLError) {
        throw new CustomError({
          name: error.name,
          message: error.message,
        });
      }
    }
  }

  /**
   * Dynamically updates parameters within a GitHub Actions workflow YML.
   * Add values of parameters configured for the Github-IF-Score-Label plugin within the run command that appends IF logo into README.md file.
   */
  function setDynamicParamsWorkflowYML(workflowObj: WorkflowYMLObj) {
    try {
      let steps = workflowObj['jobs']['update-readme']['steps'];
      if (!steps.length) {
        throw new Error();
      } else {
        steps.map(action => {
          for (const key in action) {
            if (key === 'run' && action['name']?.includes('README')) {
              let updateReadmeAction = action['run'];
              if (updateReadmeAction) {
                const endOfImgTagIndex = updateReadmeAction?.indexOf('>');
                if (endOfImgTagIndex && endOfImgTagIndex !== -1) {
                  let strToAdd = '';
                  for (const key in ifOutputsValues) {
                    strToAdd +=
                      key === 'carbon-embodied'
                        ? ` *${key}: ${ifOutputsValues[key]} gCO2eq/s`
                        : ` *${key}: ${ifOutputsValues[key]}`;
                  }
                  action['run'] =
                    updateReadmeAction.slice(0, endOfImgTagIndex + 1) +
                    '\n' +
                    strToAdd +
                    updateReadmeAction.slice(endOfImgTagIndex + 1);
                }
              } else {
                throw new Error();
              }
            }
          }
        });
      }
    } catch (error) {
      throw new CustomError({
        name: 'code error',
        message: 'Looks like template-update-label.yml is corrupted',
        description:
          'If you made changes to template-update-label.yml please reset all customized settings and configurations to their initial state',
      });
    }
  }

  /**
   * Converts the workflowJS object into a YML formatted string.
   * Generates a YML file for a GitHub Actions workflow in root directory running the nodejs process
   * If any of the methods used fails it will throw an error
   */
  function generateWorkflowYML(workflowJS: WorkflowYMLObj) {
    workflowYmlPath = rootPath + '/update-readme.yml';
    try {
      workflowYML = YAML.stringify(workflowJS, {
        collectionStyle: 'block',
        lineWidth: 0,
        minContentWidth: 0,
      });
    } catch (error) {
      if (error instanceof YAMLError) {
        throw new CustomError({
          name: error.name,
          message: error.message,
        });
      }
    }
    try {
      fs.writeFileSync(workflowYmlPath, workflowYML);
    } catch (error) {
      if (error instanceof Error) {
        throw new CustomError({
          name: 'code error',
          message: error.message,
        });
      }
    }
  }

  /**
   * Subscribing to the Node.js process beforeExit event
   * Executing functions to read, convert and process YML file created by IF.
   * The last function to execute will create the GitHub actions workflow update-readme.yml file.
   */
  function subBeforeExit() {
    process.on('beforeExit', () => {
      const ifDirectoryRef = 'index.ts';
      const ifOutputYMLPathRef = '--output';
      const ifOutputYMLPathInfo: IFOutputYmlPathInfo = setIfOutputYMLPathInfo(
        process.argv,
        [ifDirectoryRef, ifOutputYMLPathRef]
      );
      formattedIfOutputYMLPathInfo =
        formatIfOutputYMLPathInfo(ifOutputYMLPathInfo);
      ifOutputYMLJsObj = getIFOutputYML(formattedIfOutputYMLPathInfo);
      getAndSetIFOutputsValues(ifOutputYMLJsObj);
      getWorkflowYML(workflowTemplatePath);
      setDynamicParamsWorkflowYML(workflowJS);
      generateWorkflowYML(workflowJS);
    });
  }

  const metadata = {
    kind: 'execute',
  };

  /**
   * Execute's strategy description here.
   */
  const execute = async (
    inputs: PluginParams[],
    config: Record<string, any> | undefined
  ): Promise<PluginParams[]> => {
    pluginConfig = config;
    subBeforeExit();
    return inputs.map(input => {
      globalConfig;
      return {
        ...input,
      };
    });
  };
  return {
    metadata,
    execute,
    generateWorkflowYML: () => {
      return generateWorkflowYML;
    },
    workflowYML: () => {
      return workflowYML;
    },
    workflowYmlPath: () => {
      return workflowYmlPath;
    },
    setDynamicParamsWorkflowYML: () => {
      return setDynamicParamsWorkflowYML;
    },
    getIFOutputYML: () => {
      return getIFOutputYML;
    },
    getAndSetIFOutputsValues: () => {
      return getAndSetIFOutputsValues;
    },
    getPluginConfig: () => {
      return pluginConfig;
    },
    getSubBeforeExit: () => {
      return subBeforeExit;
    },
    getIfOutputsValues: () => {
      return ifOutputsValues;
    },
  };
};
